#!/bin/bash

###
# 多端打包脚本
# 支持 H5、微信小程序、支付宝小程序、Android、iOS
###

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印函数
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查 Node.js
check_node() {
    if ! command -v node &> /dev/null; then
        print_error "Node.js 未安装，请先安装 Node.js"
        exit 1
    fi
    print_info "Node.js 版本: $(node -v)"
}

# 检查依赖
check_dependencies() {
    if [ ! -d "node_modules" ]; then
        print_warning "依赖未安装，正在安装..."
        npm install
    fi
}

# 清理构建目录
clean_build() {
    print_info "清理构建目录..."
    rm -rf dist unpackage
    print_success "构建目录已清理"
}

# 构建 H5
build_h5() {
    print_info "开始构建 H5..."
    npm run build:h5
    print_success "H5 构建完成: dist/build/h5"
}

# 构建微信小程序
build_weixin() {
    print_info "开始构建微信小程序..."
    npm run build:mp-weixin
    print_success "微信小程序构建完成: dist/build/mp-weixin"
    print_warning "请使用微信开发者工具打开 dist/build/mp-weixin 目录"
}

# 构建支付宝小程序
build_alipay() {
    print_info "开始构建支付宝小程序..."
    npm run build:mp-alipay
    print_success "支付宝小程序构建完成: dist/build/mp-alipay"
    print_warning "请使用支付宝开发者工具打开 dist/build/mp-alipay 目录"
}

# 构建百度小程序
build_baidu() {
    print_info "开始构建百度小程序..."
    npm run build:mp-baidu
    print_success "百度小程序构建完成: dist/build/mp-baidu"
}

# 构建全部平台
build_all() {
    print_info "开始构建所有平台..."
    clean_build
    build_h5
    build_weixin
    build_alipay
    print_success "所有平台构建完成！"
}

# 显示帮助信息
show_help() {
    echo "用法: ./build.sh [选项]"
    echo ""
    echo "选项:"
    echo "  h5          构建 H5 版本"
    echo "  weixin      构建微信小程序"
    echo "  alipay      构建支付宝小程序"
    echo "  baidu       构建百度小程序"
    echo "  all         构建所有平台"
    echo "  clean       清理构建目录"
    echo "  help        显示帮助信息"
    echo ""
    echo "示例:"
    echo "  ./build.sh h5"
    echo "  ./build.sh weixin"
    echo "  ./build.sh all"
}

# 主函数
main() {
    print_info "========================================"
    print_info "招商金陵 - 多端打包脚本"
    print_info "========================================"
    echo ""

    check_node
    check_dependencies

    case "$1" in
        h5)
            clean_build
            build_h5
            ;;
        weixin)
            clean_build
            build_weixin
            ;;
        alipay)
            clean_build
            build_alipay
            ;;
        baidu)
            clean_build
            build_baidu
            ;;
        all)
            build_all
            ;;
        clean)
            clean_build
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            print_error "未知选项: $1"
            echo ""
            show_help
            exit 1
            ;;
    esac

    echo ""
    print_success "========================================"
    print_success "构建完成！"
    print_success "========================================"
}

# 执行主函数
main "$@"
