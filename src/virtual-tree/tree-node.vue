<template>
  <div class="el-tree-node">
    <div
      v-for="(child,index) in treeNodes"
      :key="index"
      @click.stop="handleClick($event,child)"
      :style="child.style"
      :class="{
          'is-expanded': child.expand,
          'is-hidden': !child.visible,
          'is-current':highlightId === child.id,
          'is-checked': !child.disabled && child.checked
           }">
      <div class="el-tree-node__content">
             <span v-show="!child.isLeaf"
                   class="el-tree-node__expand-icon el-icon-caret-right"
                   :class="{ 'is-leaf': child.isLeaf, expanded: !child.isLeaf && child.expand }"
                   @click.stop="handleExpand($event,child)">
             </span>

        <Checkbox
          v-show="showCheckbox"
          v-model="child.checked"
          :indeterminate="child.indeterminate"
          :disabled="!!child.disabled"
          @click.native.stop
          @change="handleCheckChange($event,child)">
        </Checkbox>
        <span v-if="child.loading" class="el-tree-node__loading-icon el-icon-loading"></span>
        <node-content :node="child"></node-content>
      </div>
      <div v-if="child.loadFail" class="el-tree-node__content">
        <node-load-fail-content :node="child"></node-load-fail-content>
      </div>
    </div>
  </div>

</template>

<script type="text/jsx">

  export default {
    name: 'ElTreeNode',

    componentName: 'ElTreeNode',

    props: {
      nodeData: {
        default() {
          return {};
        }
      },
      showCheckbox: {
        type: Boolean,
        default: false
      },
      currentNodeKey: {
        type: Number,
        default: 0
      },
    },

    components: {
      NodeContent: {
        props: {
          node: { required: true }
        },
        render(h) {
          const parent = this.$parent.$parent;
          const node = this.node;
          return (
            parent.renderContent
              ? parent.renderContent.call(parent._renderProxy,h,{ node })
              : <span class="el-tree-node__label">{ node.label }</span>
          );
        }
      },
      NodeLoadFailContent: {
        props: {
          node: { required: true }
        },
        render(h) {
          const parent = this.$parent.$parent;
          const node = this.node;
          return (
            parent.renderFailContent
              ? parent.renderFailContent.call(parent._renderProxy,h,{ parent,node })
              : <span class="el-tree-node__label">子节点加载失败</span>
          );
        }
      }
    },

    data() {
      return {
        phantomStyle: {},
        treeNodes: [],
        highlightId: this.currentNodeKey,
      };
    },

    watch: {
      nodeData: {
        immediate: true,
        deep: true,
        handler(nodeData) {
          if (nodeData.length) {
            this.treeNodes = nodeData
          }
        }
      },
    },

    methods: {
      async handleClick (e,node) {
        this.highlightId = node.id
        this.$emit('node-click',e,node);
      },

      handleExpand (e,node) {
        this.$emit('node-expand',e,node);
      },

      handleCheckChange (node) {
        this.$emit('node-check-change',node);
      }
    },
  };
</script>

<style rel="stylesheet/less" lang="less">

  .el-tree-node__expand-icon {
    display: inline-block !important;
  }

</style>


