## registerRequestPermissionTipsListener(listener?)
注册权限监听事件
## unregisterRequestPermissionTipsListener(listener?)
取消注册权限监听事件

## RequestPermissionTipsListener的属性值
|名称		|类型								|描述																							|必填	|
|:--		|:--								|:--																							|:--	|
|onRequest	|(permissions:Array<string>)=>void	|申请系统权限回调，permissions为触发权限申请的所有权限											|否		|
|onConfirm	|(permissions:Array<string>)=>void	|弹出系统权限授权框回调，permissions为触发弹出权限授权框的所有权限								|否		|
|onComplete	|(permissions:UTSJSONObject)=>void	|权限申请完成回调，permissions包括权限及权限的状态。`grant`为权限已获取，`denied`为权限已拒绝	|否		|

## setRequestPermissionTips(UTSJSONObject)
设置权限监听的说明。支持针对权限设置具体的说明。

参考：`{"android.permission.CAMERA":"<p>相机权限申请说明</p>"}`

安卓权限列表可参考[谷歌官方文档](https://developer.android.com/reference/android/Manifest.permission)。

权限申请说明基于原生TextView实现，可以实现加载html内容，支持的标签及属性可参考：
```
<b> 或 <strong>：加粗文本。
<i> 或 <em>：斜体文本。
<u>：下划线文本。
<sup>：上标文本。
<sub>：下标文本。
<tt>：等宽字体文本。
<big>：放大字体。
<small>：缩小字体。
<strike> 或 <s> 或 <del>：带有删除线的文本。
<p>：段落。
<div>：块级容器。
<h1>，<h2>，<h3>，<h4>，<h5>，<h6>：区域标题元素。
<ul>, <ol>, <li>：无序列表和有序列表。
<br>：换行。
<font color="..."> 和 <font size="...">：设置文本颜色和大小。
```

## 示例

```
<script>
	import {
		registerRequestPermissionTipsListener,
		unregisterRequestPermissionTipsListener,
		setRequestPermissionTips
	} from "@/uni_modules/uni-registerRequestPermissionTips"
	var PermissionTips = {
		"android.permission.CAMERA": "<h4 style=\"font-size:40px;\">正在读取通讯录权限</h4><font color=#cccccc>通讯录权限不会获取任何信息，请注意</font>",
		"android.permission.READ_PHONE_STATE": "<h4 style=\"font-size:40px;\">正在读取网络状态权限</h4><font color=#cccccc>通讯录权限不会获取任何信息，请注意通讯录权限不会获取任何信息，请注意通讯录权限不会获取任何信息，请注意</font>"
	}
	export default {
		onLaunch: function() {
			var brand = uni.getSystemInfoSync().deviceBrand
			setRequestPermissionTips(PermissionTips)
			registerRequestPermissionTipsListener({
				onRequest: (e) => {
					console.log(e)
				},
				onConfirm: (e) => {
					console.log(e)
				},
				onComplete: (e) => {
					// 华为手机在权限禁止之后，再次申请权限不会出现权限申请框。此时应该引导用户去系统设置开启此权限，不应该频繁申请。
					if (brand.toLowerCase() == "huawei") {
						var tips = {}
						var hasDeniedPermission = false
						for (var k in PermissionTips) {
							if (e[k] != "denied") {
								tips[k] = PermissionTips[k]
							} else {
								hasDeniedPermission = true
							}
						}
						setRequestPermissionTips(tips) // 更新弹框提醒，防止华为手机不出现权限申请框时权限提醒框闪烁的情况
						if (hasDeniedPermission)
							uni.showModal({
								content: "权限已经被拒绝，请前往设置中开启"
							})
					}
				}
			})
		},
		onShow: function() {
			console.log('App Show')
		},
		onHide: function() {
			console.log('App Hide')
		},
		onExit: function() {
			unregisterRequestPermissionTipsListener(null)
		}
	}
</script>
```