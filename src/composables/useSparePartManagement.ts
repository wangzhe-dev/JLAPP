import { ref, Ref, computed } from 'vue';
import { getPartsManagementlist } from '@/api/order';

export interface SparePart {
  spareId: string;
  spareName: string;
  quantity: number;
  spareNum: number;
}

export interface UseSparePartManagementOptions {
  /**
   * 表单数据的响应式引用
   * 例如: form 或 formModel
   */
  formData: Ref<any>;

  /**
   * 备件列表在表单中的字段路径
   * 例如: "changeParts" 或 "jneSeSpareConnectionList" 或 "repairFormData.changeParts"
   */
  fieldPath: string;
}

/**
 * 备件管理通用 Hook
 *
 * 用于管理设备维修/保养中的备件选择、添加、删除等操作
 *
 * @example
 * ```ts
 * const { fetchSpareOptions, removeSparePart, onSparePartConfirm } = useSparePartManagement({
 *   formData: form,
 *   fieldPath: 'changeParts'
 * });
 * ```
 */
export function useSparePartManagement(options: UseSparePartManagementOptions) {
  const { formData, fieldPath } = options;

  /**
   * 获取表单中指定路径的值
   */
  function getFieldValue(path: string): any {
    const keys = path.split('.');
    let value = formData.value;
    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return undefined;
      }
    }
    return value;
  }

  /**
   * 设置表单中指定路径的值
   */
  function setFieldValue(path: string, newValue: any): void {
    const keys = path.split('.');
    if (keys.length === 1) {
      formData.value[keys[0]] = newValue;
      return;
    }

    let target = formData.value;
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!target[key] || typeof target[key] !== 'object') {
        target[key] = {};
      }
      target = target[key];
    }
    target[keys[keys.length - 1]] = newValue;
  }

  /**
   * 获取当前已选备件列表
   */
  const currentSpareList = computed<SparePart[]>(() => {
    const list = getFieldValue(fieldPath);
    return Array.isArray(list) ? list : [];
  });

  /**
   * 从后端获取备件选项列表
   * 会自动标记当前已选备件的数量
   */
  async function fetchSpareOptions(): Promise<SparePart[]> {
    try {
      const resp = await getPartsManagementlist({});

      // 构建已选备件映射表
      const selectedMap = new Map<string, number>(
        currentSpareList.value.map((item: any) => [
          String(item.spareId || ''),
          Number(item.spareNum) || 0,
        ])
      );

      const result = resp
        .map((item: any) => {
          const value = String(item?.id || item?.materialCode || '');
          if (!value) return null;

          const label = item?.spareName || item?.materialName || '';
          if (!label) return null;

          const baseQty = Number(item?.spareNum || item?.quantity || 1);
          const quantity = Number.isFinite(baseQty) && baseQty > 0 ? baseQty : 1;
          const selectedQty = selectedMap.get(value) || 0;

          return {
            spareId: value,
            spareName: label,
            quantity,
            spareNum: selectedQty,
          };
        })
        .filter(Boolean) as SparePart[];

      return result;
    } catch (error) {
      console.warn('[useSparePartManagement] fetchSpareOptions failed', error);
      return [];
    }
  }

  /**
   * 移除指定备件
   */
  function removeSparePart(part: { spareId?: string }): void {
    const spareId = part?.spareId;
    if (!spareId) return;

    const list = currentSpareList.value;
    if (!list.length) return;

    const nextList = list.filter(
      (item: any) => String(item?.spareId ?? '') !== String(spareId)
    );

    if (nextList.length === list.length) return;

    setFieldValue(fieldPath, nextList);
  }

  /**
   * 确认选择的备件列表
   */
  function onSparePartConfirm(payloadList: any): void {
    if (!Array.isArray(payloadList) || !payloadList.length) {
      console.warn('[useSparePartManagement] onSparePartConfirm: 无效的 payloadList');
      return;
    }

    const currentList: SparePart[] = [];
    payloadList.forEach((payload: any) => {
      if (!payload || !payload.spareId) return;
      currentList.push({
        spareId: payload.spareId,
        spareName: payload.spareName,
        quantity: payload.quantity ?? 1,
        spareNum: payload.spareNum ?? 0,
      });
    });

    setFieldValue(fieldPath, currentList);
  }

  return {
    /**
     * 当前已选备件列表
     */
    currentSpareList,

    /**
     * 获取可选备件列表
     */
    fetchSpareOptions,

    /**
     * 移除备件
     */
    removeSparePart,

    /**
     * 确认选择备件
     */
    onSparePartConfirm,
  };
}
