/**
 * Created by huanghuanhuan on 2019/4/11 11:22
 */

import { cloneDeep,isObject,isEmpty,isNil,isFunction } from 'lodash';

class TreeStore {
  constructor (option) {
    this.treeMap = new Map();
    this.nodeMap = new Map();
    this.visibleNum = 0;
    this.listData = [];
    this.options = Object.assign({},option);

  }

  /*遍历树结构*/
  iterateTreeNode (node,treeList,option,parentId,parentPath,parentNodeKey,cb = () => {}) {
    let cloneNode = cloneDeep(node);
    const childrenKey = option.props.children;
    delete cloneNode[childrenKey];
    cloneNode.parentNodeKey = parentNodeKey;
    if (isObject(parentId)) {
      cloneNode.parentId = parentId.sectorId;
    } else {
      cloneNode.parentId = parentId;
    }
    cloneNode.idObj = cloneDeep(node.id);
    if (isObject(node.id)) {
      cloneNode.id = node.id.sectorId;
    }
    if (node.meta && node.meta.name) {
      cloneNode.label = node.meta.name;
    } else {
      cloneNode.label = undefined;
    }

    cloneNode.path = parentId !== null ? cloneDeep(parentPath) : [cloneNode.id]
    if (!isNil(parentId)) {
      cloneNode.path.push(cloneNode.id)
    }

    cloneNode.index = treeList.length;
    const nodeId = isObject(cloneNode.id) ? 0 : cloneNode.id;

    this.treeMap.set(nodeId,node); // sectorModel 进行扁平化存储
    cb(cloneNode);

    treeList.push(cloneNode);

    // 处理子级
    if (Array.isArray(node[childrenKey]) && node[childrenKey].length) {
      node[childrenKey].forEach(child => {
        this.iterateTreeNode(child,treeList,option,node.id,cloneNode.path,cloneNode[option.nodeKey]);
      })
    }
  }

  /*树转成扁平化*/
  tree2Line (option,cb) {
    let treeList = [];
    let tree = option.tree || [];
    if (Array.isArray(tree) && tree.length) {
      tree.forEach((nodeModel) => {
        this.iterateTreeNode(nodeModel,treeList,option,null,cb);
      })
    }
    return treeList;
  }

  // 初始化滚动参数
  initScrollParams (option) {
    this.visibleNum = 0;
    Object.assign(this.options,option);
  }

  /*初始化可视区域nodes*/
  async initVisibleNodes (index,cloneNode,resolve) {

    const options = this.options;

    /*该节点的父级node*/
    const parentNode = this.getNodeByKey(cloneNode.parentNodeKey);

    // 处理根节点expand状态
    if (isNil(cloneNode.parentNodeKey)) {
      cloneNode.expand = true;
    }

    /* 可视区域内，不满足数量情况下*/
    if (index >= options.startIndex && this.visibleNum <= options.visibleItemCount) {
      if (isEmpty(cloneNode.label) || isNil(cloneNode.label)) {   // 未获取label
        this.visibleNum += 1;
        try {
          if (isFunction(options.loadNodeMeta)) {
            cloneNode = await options.loadNodeMeta(cloneNode);
          }
        } catch (e) {
          cloneNode.loadFail = true; // 数据加载失败
        }
        return resolve ? resolve(cloneNode) : cloneNode;
      } else if (parentNode && parentNode.expand) { //判断父级节点是展开的
        this.visibleNum += 1;
        return resolve ? resolve(cloneNode) : cloneNode;
      } else if (!parentNode) { // tree根节点
        this.visibleNum += 1;
        return resolve ? resolve(cloneNode) : cloneNode;
      } else if (index <= options.endIndex) {  // 可视区域内
        this.visibleNum += 1;
        return cloneNode;
      }
    } else {  // 可视区域之外
      this.setNodeByKey(cloneNode[options.nodeKey],cloneNode);
      return cloneNode;
    }
  }

  setChildrenNodeState (node) {
    this.iterateChildrenNode(node,childNode => {
      if (childNode.parentId === node.id) { // 搜索是父子节点的全部隐藏
        childNode.visible = node.expand;
        childNode.expand = false;
        this.setNodeByKey(childNode.id,childNode);
      } else {
        if (!node.expand) { // 收起时子节点全部隐藏, 子孙节点
          childNode.visible = false;
          childNode.expand = false;
          this.setNodeByKey(childNode.id,childNode);
        } else { // 展开时孙子节点的显示根据孙子节点的父节点是否展开
          let grandsonNode = this.getNodeByKey(childNode[this.options.nodeKey]);
          let grandsonParent = this.getNodeByKey(grandsonNode.parentNodeKey);
          if (grandsonParent) {
            grandsonNode.visible = grandsonParent.expand;
            this.setNodeByKey(grandsonNode.id,grandsonNode);
          }
        }
      }
    })
  }

  iterateChildrenNode (node,cb) { // 取出父节点的所有子(孙子)节点
    const listData_length = this.listData.length;
    if (!listData_length) { return false;}
    for (let i = node.index + 1; i < listData_length; i++) {
      const currentNode = this.listData[i]
      if (currentNode) {
        let isMatchBasePath = true
        // 判断currentNode是否是node的子节点，防止是跨级子节点，所以循环path来判断
        node.path.forEach((id,index) => {
          isMatchBasePath = id === currentNode.path[index]
        })
        if (!isMatchBasePath) break
        cb(currentNode)
      }
    }
  }

  getTreeByKey (nodeKey,map) {
    return (map || this.treeMap).get(nodeKey)
  }

  getNodeByKey (nodeKey,map) {
    return (map || this.nodeMap).get(nodeKey)
  }

  setNodeByKey (nodeKey,node) {
    this.nodeMap.set(nodeKey,node);
  }

  setTreeByKey (nodeKey,node) {
    this.treeMap.set(nodeKey,node);
  }

}

export default TreeStore
