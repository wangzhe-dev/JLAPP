<template>
  <div class="err-wrapper">
    <div class="code">404</div>
    <div class="desc">抱歉，页面不存在或已被移除</div>
    <sar-button type="outline" @click="goHome" block round>返回首页</sar-button>
  </div>
</template>
<script setup lang="ts">
const goHome = () => {
  uni.switchTab({ url: '/pages/index/index' })
}
</script>
<style scoped lang="scss">
.err-wrapper { min-height:100vh; display:flex; flex-direction:column; justify-content:center; align-items:center; padding:80rpx 40rpx; box-sizing:border-box; background:#f6f7f9; }
.code { font-size:140rpx; font-weight:600; background:linear-gradient(135deg,#0B3D91,#1565C0); background-clip:text; -webkit-background-clip:text; color:transparent; line-height:1; }
.desc { margin:40rpx 0 60rpx; font-size:30rpx; color:#666; text-align:center; }
</style>
