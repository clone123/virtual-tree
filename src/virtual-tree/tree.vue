<template>
  <div class="virtual-tree" :id="idSymbol" @scroll="rootScroll">
    <div class="tree__phantom" :style="phantomStyle"></div>
    <div ref="content">
      <el-tree-node
        :nodeData="treeNodes"
        :showCheckbox="showCheckbox"
        :render-content="renderContent"
        :render-fail-content="renderFailContent"
        @node-click="nodeClick"
        @node-expand="nodeExpand">
      </el-tree-node>
    </div>

  </div>
</template>
<script type="text/ecmascript-6">
  import _ from 'lodash'
  import TreeNode from './node.js'
  import ElTreeNode from './tree-node.vue';
  export default {
    props: {
      data: {
        type: Array,
        default () {
          return []
        }
      },
      emptyText: {
        type: String,
        default () {
          return '没有数据'
        }
      },
      nodeKey: {
        type: String,
        default: undefined
      },
      showCheckbox: {
        type: Boolean,
        default: false
      },
      checkStrictly: {
        type: Boolean,
        default: undefined
      },
      defaultExpandAll: {
        type: Boolean,
        default: undefined
      },
      expandOnClickNode: {
        type: Boolean,
        default: true
      },
      autoExpandParent: {
        type: Boolean,
        default: true
      },
      defaultCheckedKeys: {
        type: Array,
        default () {
          return []
        }
      },
      defaultExpandedKeys: {
        type: Array,
        default () {
          return []
        }
      },

      currentNodeKey: {
        type: Number,
        default: 0
      },
      props: {
        default() {
          return {
            children: 'children',
            label: 'label',
            icon: 'icon',
            disabled: 'disabled',
          };
        }
      },
      filterNodeMethod: Function,
      loadNodeChildren: Function,
      loadNodeMeta: Function,
      renderContent: Function,
      renderFailContent: Function,
    },
    data() {
      return {
        treeNode: null,
        idSymbol: Math.random().toString(36).substring(2),
        nodeCount: 20,
        positionConfig: {
          startIndex: 0,
          endIndex: 20
        },
        itemHeight: 20,
        visibleItemCount: 20,
        highlightIndex: -1,
        highlightId: this.currentNodeKey,
        phantomLength: 0,
      }
    },
    components: {
      ElTreeNode,
    },
    computed: {

      treeNodes() {
        if (!this.treeNode) return [];
        const visibleNodeList = this.getVisibleNodeList();
        if (Array.isArray(visibleNodeList) && visibleNodeList.length > 0) {
          this.$emit('node-load',false);
        }
        return visibleNodeList;
      },
      phantomStyle() {
        const length = this.treeNodes.length; //this.treeNode ? this.treeNode.listData.length : 0;
        let totalHeight = length * this.itemHeight + 'px';
        return {
          height: totalHeight
        }
      },
    },
    watch: {
      data: {
        immediate: true,
        deep: true,
        handler(tree) {
          if (tree.length) {
            if (this.treeNode) {
              this.treeNode.setData({ tree });
            } else {
              this.initTreeNode(tree);
            }
          }
        }
      },
    },
    methods: {
      getCheckedNodes (leafOnly = false) {
        let arr = []
        this.treeNode.nodeMap.forEach((val,key) => {
          if (!val.checked) return
          if (leafOnly) {
            if (val.isLeaf) {
              arr.push(val)
            }
          } else {
            arr.push(val)
          }
        })
        return arr
      },
      getCheckedKeys (leafOnly = false) {
        let checkedNodes = this.getCheckedNodes(leafOnly)
        return checkedNodes.map(node => {
          return node[this.nodeKey]
        })
      },
      getAllNodesStatus () {
        return this.treeNode.listData
      },
      setChecked (dataOrKey,checked,deep) {
        this.treeNode.setChecked(dataOrKey,checked,deep)
      },
      setCheckedNodes (nodes = []) {
        this.treeNode.setCheckedNodes(nodes)
      },
      setCheckedKeys (checkedArr = []) {
        if (!this.nodeKey) throw new Error('[Tree] nodeKey is required in setDisableKeys')
        this.treeNode.setCheckedKeys(checkedArr)
      },
      getVisibleNodeList () {
        let { startIndex,endIndex } = this.positionConfig;

        const visibleNodeList = this.treeNode.listData.filter((item) => {
          return item.visible;
        }).slice(startIndex,endIndex);

        return visibleNodeList;
      },
      setDisableKeys (keys) {
        if (!this.nodeKey) throw new Error('[Tree] nodeKey is required in setDisableKeys')
        if (!this.showCheckbox) throw new Error('Use this methods when checkbox exists')
        if (!Array.isArray(keys)) throw new Error('[Tree] params keys expected Array in setDisableKeys')
        this.treeNode.setDisableKeys(keys,this.props)
      },
      filter (field) {
        this.treeNode.filter(field,this.filterNodeMethod,this.nodeKey)
      },

      checkChange (node) {
        this.treeNode.handleCheckChange(node)
        this.$emit('on-check-change',node,node.checked,node.indeterminate)
      },

      // 重新获取子节点
      async refreshChildren (node) {

        const nodeModel = this.treeNode.getTreeByKey(node.id)

        // node已经点击过且没有子级
        if (!nodeModel.children.length) {
          try {
            node.click = true;
            node.loading = true;
            this.treeNode.setNodeByKey(node.id,node);  // 重置nodeMap里面的node
            await this.loadNodeChildren(nodeModel);
          } catch (error) {
            node.loadFail = true;
            node.loading = false;
            this.treeNode.setNodeByKey(node.id,node);  // 重置nodeMap里面的node
          }
        }
      },

      // 点击node节点
      async nodeClick (e,node) {
        if (e.srcElement.className.indexOf('checkbox') > -1) return false;
        node.checked = !node.checked;
        const nodeModel = this.treeNode.getTreeByKey(node.id);
        if (!node.expand) {
          this.$emit('node-click',nodeModel,node);
        }
        this.nodeExpand(e,node);
      },

      async nodeExpand (e,node) { // 点击展开处理
        if (node.isLeaf) return
        const nodeModel = this.treeNode.getTreeByKey(node.id);

        node.expand = !node.expand;

        // node已经点击过且没有子级
        if (!nodeModel.children.length && !node.click) {
          try {
            node.click = true;
            node.loading = true;
            this.treeNode.setNodeByKey(node.id,node);  // 重置nodeMap里面的node
            await this.loadNodeChildren(nodeModel);
          } catch (error) {
            node.loadFail = true;
            node.loading = false;
            this.treeNode.setNodeByKey(node.id,node);  // 重置nodeMap里面的node
          }
        }
        this.treeNode.setNodeByKey(node.id,node);  // 重置nodeMap里面的node
        this.treeNode.setChildrenNodeState(node); // 设置与该Node相关的父子节点状态

        this.$emit('node-expand',node);
      },

      // 滚动处理
      rootScroll: _.throttle(function () {
        this.updateData(this.$el.scrollTop);
      },200),

      // 滚动更新配置
      updateData(scrollTop = 0) {
        const newStartIndex = Math.floor(scrollTop / this.itemHeight); // 滚动之后可见区域新的起始index
        const newEndIndex = newStartIndex + this.visibleItemCount;// 滚动之后可见区域新的截止index
        this.positionConfig.startIndex = newStartIndex;
        this.positionConfig.endIndex = newEndIndex;

        // 把可见区域的 top 设置为起始元素在整个列表中的位置（使用 transform 是为了更好的性能）
        this.$refs.content.style.transform = `translate3d(0, ${newStartIndex * this.itemHeight}px, 0)`;
        this.updateVirtualData();

      },

      async updateVirtualData () {
        const treeNode = this.treeNode;
        treeNode.initScrollParams(this.positionConfig);
        const treeNodePromise = treeNode.listData.map(async (nodeData,index) => {
          /*设置可视区node*/
          nodeData = await treeNode.initVisibleNodes(index,nodeData,(node) => {
            node.visible = true;
            node.load = true;
            this.treeNode.setNodeByKey(node[this.nodeKey],node);
            return node;
          });
          return nodeData;
        })
        await Promise.all(treeNodePromise);
      },

      remove (nodeKey) {
        const node = this.treeNode.getNodeByKey(nodeKey + '');

        const parentNode = this.treeNode.getNodeByKey(node.parentNodeKey);
        const parentTree = this.treeNode.getTreeByKey(parentNode.id);

        const childrenNodeList = this.treeNode.listData.filter((n) => {
          return n.parentId === parentNode.id;
        });

        this.treeNode.listData = _.remove(this.treeNode.listData,(data) => {
          if (data.id === parentNode.id) {
            data.isLeaf = childrenNodeList.length >= 2 ? false : true;
            this.treeNode.setNodeByKey(data[this.nodeKey],data);
          }
          return data.id !== node.id;
        })

        parentTree.children = _.remove(parentTree.children,(children) => {
          return children.id.sectorId !== node.id;
        })

        this.treeNode.setTreeByKey(parentNode.id,parentTree);

        this.treeNode.nodeMap.delete(node[this.nodeKey]);
        this.treeNode.treeMap.delete(node.id);

      },

      initTreeNode(tree = []) {
        if (!Array.isArray(tree)) {
          throw new Error('The type if tree data must to be Array!')
        }

        this.treeNode = new TreeNode({
          tree: tree,
          loadNodeMeta: this.loadNodeMeta,
          startIndex: this.positionConfig.startIndex,
          endIndex: this.positionConfig.endIndex,
          visibleItemCount: this.visibleItemCount,
          defaultCheckedKeys: this.defaultCheckedKeys || [],
          defaultExpandAll: this.defaultExpandAll,
          props: this.props,
          nodeKey: this.nodeKey,
          defaultExpandedKeys: this.defaultExpandedKeys,
          indent: this.indent,
          checkStrictly: this.checkStrictly
        })
      }
    },
    mounted() {
      // 可见区域可见列表项数
      this.visibleItemCount = Math.ceil(this.$el.clientHeight / this.itemHeight)
      this.positionConfig.endIndex = this.visibleItemCount;
    }
  }
</script>
<style rel="stylesheet/less" lang="less">
  .virtual-tree {
    height: 100%;
    overflow: auto;
    overflow-x: auto;
    position: relative;

    .is-current {
      background-color: #f1f5fb;
    }
    .tree__phantom {
      position: absolute;
      left: 0;
      top: 0;
      right: 0;
      z-index: -1;
    }

    .virtual-tree__content {
      left: 0;
      right: 0;
      top: 0;
      position: absolute;

      .virtual-tree__item {
        display: flex;
        align-items: center;
        cursor: pointer;

        &:hover {
          background-color: #eee;
        }

        &.node-highlight {
          background-color: #eee;
        }

      }

    }
  }

</style>
