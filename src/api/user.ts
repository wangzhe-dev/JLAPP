import { http } from '@/utils/request'
import { EP } from './endpoints'
import type { GetInfo } from '@/types/api/user'

// 登录请求参数与响应类型（根据常见后台返回结构，可按实际后端调整）
export interface LoginParams { userName: string; password: string }
export interface LoginResp { token?: string; access_token?: string; refresh_token?: string; [k: string]: any }

// 获取用户信息
export const getInfo = () => http.get<GetInfo.Body>(EP.USER_INFO)

// 用户登录（账号密码）
export const login = (data: LoginParams) => http.postQuery<LoginResp>(EP.AUTH_LOGIN, data)