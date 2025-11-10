// PageLayout 注入 token 定义，独立文件避免 <script setup> export 语法冲突
export const PAGE_LAYOUT_CONTENT_REF = Symbol('PAGE_LAYOUT_CONTENT_REF')
export const PAGE_LAYOUT_GO_BACK = Symbol('PAGE_LAYOUT_GO_BACK')
export const PAGE_LAYOUT_SCROLL_MANAGER = Symbol('PAGE_LAYOUT_SCROLL_MANAGER')
