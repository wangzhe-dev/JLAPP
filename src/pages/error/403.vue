<template>
  <div class="err-wrapper">
    <div class="code">403</div>
    <div class="desc">抱歉，您没有访问此页面的权限</div>
    <sar-button type="outline" block round @click="goHome">返回首页</sar-button>
  </div>
</template>
<script setup lang="ts">
function goHome(){
  uni.switchTab({ url: '/pages/index/index' })
}
</script>
<style scoped lang="scss">
.err-wrapper { padding:120rpx 40rpx 60rpx; text-align:center; color:#333; }
.code { font-size:140rpx; font-weight:600; background:linear-gradient(135deg,#ff4d4f,#ffa39e); background-clip:text; -webkit-background-clip:text; color:transparent; line-height:1; }
.desc { margin:40rpx 0 60rpx; font-size:30rpx; color:#666; }
</style>
