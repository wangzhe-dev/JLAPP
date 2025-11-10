<script setup lang="ts">
// 使用官方 sar-input；根据字段配置支持 number / text
const props = defineProps<{ field:any; state:any; disabled:boolean; readonly?:boolean; setValue:(v:any)=>void }>()
const isNumber = props.field.component === 'Number'
</script>
<template>
  <sar-input
    :model-value="props.state.value"
    :type="isNumber ? 'digit' : (props.field.inputType || 'text')"
    :disabled="props.disabled"
    :readonly="props.readonly"
    :placeholder="props.field.placeholder"
    clearable
    inlaid
    @update:model-value="val => props.setValue(val)"
  />
</template>
