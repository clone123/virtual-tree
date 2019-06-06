import { cloneDeep,isObject,isEmpty,isNil,isFunction } from 'lodash';
import TreeStore from './tree-store.js';

class TreeNode extends TreeStore {

  constructor (...args) {
    super(...args)

    this.init();
  }

  async init () {
    const lineListData = this.tree2Line(this.options);
    this.listData = await this.initNodeData(lineListData);
  }

  setData (option) {
    Object.assign(this.options,option);
    this.init();
  }

  // 初始化Node
  async  initNodeData (dataList = []) {

    let nodeList = cloneDeep(dataList);
    const options = this.options;

    this.initScrollParams(options);

    const listPromise = nodeList.map(async (node,index) => {

      let cloneNode = node;  // cloneDeep(node)  map 内 node 不能深clone
      let nodeModel = this.getNodeByKey(cloneNode[options.nodeKey]) // 从nodeMap池子里查询该node
      if (!nodeModel) { // 如果没有，初始化属性
        cloneNode = this.initNodeProperty(cloneNode);
        cloneNode.expand = !!(options.defaultExpandAll || cloneNode.expand) // 展开
        cloneNode.checked = options.defaultCheckedKeys.includes(cloneNode.id) // 选中状态
      } else {

        /*如果已存在该node节点，进行覆盖*/
        cloneNode = Object.assign(cloneNode,nodeModel);

        /* 处理之前没有子节点的，但是展示上面显示的是有子节点*/
        if (cloneNode.click) {
          const treeNode = this.getTreeByKey(cloneNode.id)
          cloneNode.isLeaf = treeNode.children.length ? false : true;
        }
      }
      /*如果前面新增了节点，index值需更新*/
      cloneNode.index = index;

      cloneNode.loading = false;
      cloneNode.loadFail = false;

      /*设置初始可视区域显示的node*/
      cloneNode = await this.initVisibleNodes(index,cloneNode,(newNode) => {
        newNode.visible = true;
        newNode.load = true;
        this.setNodeByKey(newNode[options.nodeKey],newNode);
        return newNode;
      });
      return cloneNode;
    })

    await Promise.all(listPromise);

    return nodeList;
  }

  initNodeProperty (node) {
    const offsetLeft = (node.path.length - 1) * 18;
    node.style = `padding-left: ${offsetLeft}px`;
    node.indeterminate = false // 半选状态
    node.visible = false  // 不可见
    node.isLeaf = false;  // 默认不是根节点
    node.expand = false;  // 默认不展开
    node.click = false; // 没点击过
    node.load = false;
    node.loading = false;
    node.loadFail = false;
    return node;
  }

  clearChecked () {
    this.listData.forEach(node => {
      node.checked = false
      node.indeterminate = false
    })
  }

  setCheckedKeys (checkedKeys) {
    this.clearChecked()
    checkedKeys.forEach(key => {
      let node = this.getNodeByKey(key)
      node.checked = true
      !this.checkStrictly && this.handleCheckChange(node)
    })
  }

  setChecked (dataOrKey,checked,deep) {
    let setNode
    if (isObject(dataOrKey)) {
      this.listData.forEach(node => {
        if (node.id === dataOrKey.id) {
          setNode = node
          node.checked = checked
        }
      })
    } else {
      setNode = this.getNodeByKey(dataOrKey)
      setNode.checked = checked
    }
    deep && this.handleCheckChange(setNode)
  }

  setCheckedNodes (nodes) {
    this.clearChecked()
    let ids = nodes.map(node => {
      return node.id
    })
    this.listData.forEach(node => {
      if (ids.includes(node.id)) {
        node.checked = true
        !this.checkStrictly && this.handleCheckChange(node)
      }
    })
  }

  setDefaultCheckedKeys (defaultCheckedKeys) {
    defaultCheckedKeys.forEach(key => {
      let node = this.getNodeByKey(key)
      node.checked = true
      !this.checkStrictly && this.handleCheckChange(node)
    })
  }

  setDefaultExpendedNodes (defaultExpandedKeys) {
    defaultExpandedKeys.forEach(key => {
      let node = this.getNodeByKey(key)
      node.visible = true
      this.checkParentExpended(node)
    })
  }

  checkParentExpended (node) {
    if (!node.isLeaf) {
      this.iterateChildrenNode(node,childNode => {
        if (childNode.path.length - node.path.length === 1) {
          childNode.visible = true
        }
      })
    }
    if (!node.parentNodeKey) return
    let parentNode = this.getNodeByKey(node.parentNodeKey)
    parentNode.expand = true
    parentNode.visible = true
    this.checkParentExpended(parentNode)
  }

  filter (field,filterNodeMethod,nodeKey) {
    let parentNodeKeys = []
    this.listData.forEach(item => {
      let isMatch = filterNodeMethod(field,this.getNodeByKey(item[nodeKey]))
      if (isMatch) {
        item.visible = true
        if (item.parentNodeKey && !parentNodeKeys.includes(item.parentNodeKey)) {
          parentNodeKeys.push(item.parentNodeKey)
        }
      } else {
        item.visible = false
      }
    })
    parentNodeKeys.forEach(key => {
      this.visibleParentNode(this.getTreeByKey(key,this.nodeMap))
    })
  }

  visibleParentNode (node) {
    node.visible = true
    // 默认tree 根节点也展示出来
    if (node.parentNodeKey || isNil(node.parentId)) {
      let parentNode = this.getNodeByKey(node.parentNodeKey)
      if (parentNode) {
        parentNode.visible = true
        this.visibleParentNode(parentNode)
      }
    }
  }

  setDisableKeys (keys,props) {
    let { disabled: disabledKey,children: childrenKey } = props
    if (keys.length === 0) {
      return this.listData.forEach(node => {
        node[disabledKey] = false
      })
    }
    keys.forEach(key => {
      let node = this.getTreeByKey(key,this.nodeMap)
      node[disabledKey] = true
      if (!node.isLeaf) {
        let children = this.getTreeByKey(key)[childrenKey]
        children.forEach(({ id }) => {
          this.getTreeByKey(id,this.nodeMap)[disabledKey] = true
        })
      }
    })
  }

  handleCheckChange (node) { // 点击勾选checkbox处理
    if (node.checked) node.indeterminate = false
    this.iterateChildrenNode(node,cbNode => { cbNode.checked = node.checked })
    this.checkParentChecked(node.parentId)
  }

  checkParentIndeterminate (parentNode,childrenNode) { // 父节点半选状态
    const hasChecked = childrenNode.some(node => node.checked)
    const hasUnchecked = childrenNode.some(node => !node.checked)
    const hasCheckedAndUnchecked = hasChecked && hasUnchecked
    const childrenHasIndeterminate = childrenNode.some(node => node.indeterminate)
    const isIndeterminate = hasCheckedAndUnchecked || childrenHasIndeterminate
    parentNode.indeterminate = !!isIndeterminate
    childrenNode.forEach(node => {
      if (node.checked) node.indeterminate = false
    })
  }

  checkParentChecked (parentId) { // 父节点check状态
    if (parentId === null) return
    const allDirectChildren = this.listData.filter(node => node.parentId === parentId)
    const parentNode = this.listData.find(node => node.id === parentId)
    const childrenAllChecked = allDirectChildren.every(node => node.checked)
    this.checkParentIndeterminate(parentNode,allDirectChildren)
    parentNode.checked = childrenAllChecked
    if (childrenAllChecked) parentNode.indeterminate = false

    if (parentNode.parentId !== null) this.checkParentChecked(parentNode.parentId)
  }

}

export  default TreeNode ;
