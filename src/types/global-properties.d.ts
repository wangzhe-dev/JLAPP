import type { Uni as _Uni } from '@dcloudio/types'

export { }

// 全局扩展变量属性
declare module 'vue' {
	interface ComponentCustomProperties {
		$loginPage : string
		$imgUrl : string
		$mainColor : string
		$navigateToWithGuard: (path: string, options?: { params?: Record<string, any>, method?: 'navigateTo' | 'switchTab' | 'redirectTo' | 'reLaunch' }) => void
	}
}

// 拓展全局变量Uni
declare global {
	interface Uni extends _Uni {
		$tao : {
			toast(title : string, duration ?: number) : void,
			copy(text : string, toastTitle ?: string) : void,
			validate : {
				email(value : string) : boolean,
				mobile(value : string) : boolean,
				url(value : string) : boolean,
				date(value : string) : boolean,
				dateISO(value : string) : boolean,
				number(value : string) : boolean,
				string(value : string) : boolean,
				digits(value : string) : boolean,
				idCard(value : string) : boolean,
				carNo(value : string) : boolean,
				amount(value : string) : boolean,
				chinese(value : string) : boolean,
				letter(value : string) : boolean,
				enOrNum(value : string) : boolean,
				contains(value : string, param : string) : boolean,
				range(value : number, param : number[]) : boolean,
				rangeLength(value : string, param : number[]) : boolean,
				landline(value : string) : boolean,
				empty(value : unknown) : boolean,
				jsonString(value : string) : boolean,
				array(value : unknown) : boolean,
				object(value : unknown) : boolean,
				code(value : string, len ?: number) : boolean,
				func(value : unknown) : boolean,
				promise(value : unknown) : boolean,
				image(value : string) : boolean,
				video(value : string) : boolean,
				regExp(value : unknown) : boolean
			}
		}
	}
}