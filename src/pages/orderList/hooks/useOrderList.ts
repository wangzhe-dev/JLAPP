// @ts-nocheck
import { ref, reactive, nextTick, computed, watch, onUnmounted } from "vue";
import { onLoad, onShow } from "@dcloudio/uni-app";
import {
	userAllList,
	equipmentRepairdispatch,
	equipmentRepairauditing,
	issueOrder,
	inspectIssueOrderList,
	getOrderList,
	selectMaintainOrder,
	selectOrderPageCheck,
	selectMyOrderPageCheck,
	extractPage,
	requestOrder,
	transferOrder as transferOrderAPI,
	inspectTransferOrder as inspectTransferOrderAPI,
	getWorkOrder,
	inspectWorkOrder,
	submitOrder,
} from "@/api/order";

import { commitCheckMission } from "@/api/inspection";
import { queryDictList as queryDictListBatch } from "@/api/dict";
import { resolveStatusState } from "@/utils/status";
import { formatDateTime, formatDateYMD } from "@/utils/date";
import { buildUrl } from "@/utils/url";

const tabs = [
	{ name: "a", title: "维修工单" },
	{ name: "b", title: "保养工单" },
	{ name: "c", title: "点检工单" },
];

const STATUS_ALL_KEY = "__ALL__";

// 统一收拢工单列表页面涉及的状态与逻辑，方便在组件内复用
export function useOrderList() {
	const activeTabName = ref("a");
	const source = ref<"1" | "2">("1");
	const reasonType = ref<1 | 3>(1);

	const query = ref({ type: "repair", status: "", keyword: "" });
	const listRef = ref<any>(null);
	const listHeight = "auto";
	const pageSize = 10;
	const searchValue = ref("");

	const dictRepairManage = ref<any[]>([]);
	const dictMaintainManage = ref<any[]>([]);
	const dictInspectManage = ref<any[]>([]);
	const dictRepairMine = ref<any[]>([]);
	const dictMaintainMine = ref<any[]>([]);
	const dictInspectMine = ref<any[]>([]);

	const activeStatusName = ref(STATUS_ALL_KEY);
	const statusTabs = computed(() => {
		const isMine = source.value === "2";
		let arr: any[] = [];
		if (activeTabName.value === "a")
			arr = isMine ? dictRepairMine.value : dictRepairManage.value;
		else if (activeTabName.value === "b")
			arr = isMine ? dictMaintainMine.value : dictMaintainManage.value;
		else arr = isMine ? dictInspectMine.value : dictInspectManage.value;
		return arr;
	});

	let isSettingUp = false;
	let hasInitialized = false;
	let isFirstShow = true; // 标记是否是第一次 onShow

	const dispatchPopoutVisible = ref(false);
	const dispatchSelected = ref<string[] | undefined>();
	const dispatchOptions = ref<{ value: string; label: string; raw: any }[]>([]);
	const dispatchOptionsLoading = ref(false);
	const dispatchOptionsLoaded = ref(false);
	const pendingDispatchItem = ref<any>(null);
	const pendingDispatchType = ref<"repair" | "maintain" | "inspect" | null>(
		null
	);

	const selectedDispatchUser = ref<{
		value: string;
		label: string;
		raw: any;
	} | null>(null);
	const dispatching = ref(false);
	const dispatchPlanVisible = ref(false);
	const dispatchPlanDate = ref("");

	const tempPlanDate = ref("");
	const tempPlanTime = ref("");
	const remark = ref("");
	const causeDetails = ref("");

	const approvePopoutVisible = ref(false);
	const upkeepPopoutVisible = ref(false);
	const approveItem = ref<any>(null);
	const approveSelection = ref<"pass" | "fail">("pass");
	const approveRemark = ref("");
	const approveContext = reactive({
		orderCode: "-",
		equipmentName: "-",
		orderId: "",
	});
	const approveLoading = ref(false);

	const selectedItem = ref<any>(null);
	const showTime = ref(false);
	const showRemark = ref(false);
	const showCauseDetails = ref(false);
	const loadingSubmit = ref(false);
	const inspectPopoutVisible = ref(false);
	const inspectContext = ref<{
		id: string;
		mtNo: string;
		equipmentName?: string;
		equipmentCode?: string;
		type?: string;
		checkDetailList?: any[];
	} | null>(null);
	const inspectSubmitting = ref(false);
	const inspectLoading = ref(false);

	const lastActionTime = ref(0);
	const lastMaintainTime = ref(0); // 防止 maintain 重复调用
	const maintainDebounceTime = 500; // 500ms 内不允许重复调用 maintain

	const searchDebounceTimer = ref<any>(null);

	function buildStatusName(raw: string, fallbackIdx: number, label: string) {
		if (raw) return `val::${raw}`;
		const labelKey = label ? label.replace(/\s+/g, "_") : "";
		if (labelKey) return `label::${labelKey}`;
		return `idx::${fallbackIdx}`;
	}

	function normalizeDict(arr: any[]) {
		if (!Array.isArray(arr)) {
			return [{ name: STATUS_ALL_KEY, value: STATUS_ALL_KEY, title: "全部" }];
		}
		const mapped = [...arr].map((it, idx) => {
			const rawVal = (it.dictValue ?? it.dictCode ?? "") + "";
			const label = it.dictLabel ?? it.dictName ?? "";
			const uniqueName = buildStatusName(rawVal, idx, label);
			return {
				name: uniqueName,
				value: rawVal,
				title: label,
				raw: it,
			};
		});
		return [
			{ name: STATUS_ALL_KEY, value: STATUS_ALL_KEY, title: "全部" },
			...mapped,
		];
	}

	async function loadDictionaries() {
		const manageCodes = [
			"repair_order_status_type",
			"applet_maintenance_order_status",
			"inspect_type",
		];
		const mineCodes = [
			"my_repair_order_status_type",
			"my_applet_maintenance_order_status",
			"check_condition",
		];
		try {
			const codes = source.value === "1" ? manageCodes : mineCodes;
			const data = await queryDictListBatch(codes);
			if (source.value === "1") {
				dictRepairManage.value = normalizeDict(data.repair_order_status_type);
				dictMaintainManage.value = normalizeDict(
					data.applet_maintenance_order_status
				);
				dictInspectManage.value = normalizeDict(data.inspect_type);
			} else {
				dictRepairMine.value = normalizeDict(data.my_repair_order_status_type);
				dictMaintainMine.value = normalizeDict(
					data.my_applet_maintenance_order_status
				);
				dictInspectMine.value = normalizeDict(data.check_condition);
			}
		} catch (e) {
			console.warn("[WorkOrderList] loadDictionaries failed", e);
		} finally {
			ensureActiveStatusValid();
		}
	}

	function ensureActiveStatusValid() {
		const tabsArr = statusTabs.value || [];
		const found = tabsArr.find((t: any) => t.name === activeStatusName.value);
		if (!found) {
			if (activeStatusName.value !== STATUS_ALL_KEY) {
				activeStatusName.value = STATUS_ALL_KEY;
			}
			query.value.status = "";
		} else {
			const nextStatus =
				found.value === STATUS_ALL_KEY || found.value == null
					? ""
					: String(found.value);
			query.value.status = nextStatus;
		}
		rememberStatus(activeStatusName.value);
	}

	function safeGetStorage(key: string): string {
		try {
			const val = uni.getStorageSync(key);
			if (val !== undefined && val !== null && val !== "") return String(val);
		} catch {}
		return "";
	}

	function safeSetStorage(key: string, value: string) {
		try {
			uni.setStorageSync(key, value);
		} catch {}
	}

	function buildStatusStorageKey(src: string, tab: string) {
		const normalizedSrc = src === "2" ? "2" : "1";
		const normalizedTab = ["a", "b", "c"].includes(tab) ? tab : "a";
		return `orderListStatus::${normalizedSrc}::${normalizedTab}`;
	}

	function restoreStatusFromStorage(forceDefault = false) {
		if (forceDefault) {
			activeStatusName.value = STATUS_ALL_KEY;
			ensureActiveStatusValid();
			return;
		}
		const key = buildStatusStorageKey(source.value, activeTabName.value);
		const stored = safeGetStorage(key);
		let nextName = STATUS_ALL_KEY;

		if (stored) {
			const tabsArr = statusTabs.value || [];
			const matchByValue = (rawValue: string) =>
				tabsArr.find((t: any) => String(t.value ?? "") === String(rawValue));

			let parsed: any = null;
			try {
				parsed = JSON.parse(stored);
			} catch (err) {}

			if (parsed && typeof parsed === "object") {
				const byName = tabsArr.find((t: any) => t.name === parsed.name);
				if (byName) {
					nextName = byName.name;
				} else if (parsed.value !== undefined) {
					const byValue = matchByValue(String(parsed.value ?? ""));
					if (byValue) {
						nextName = byValue.name;
					}
				}
			} else if (stored === STATUS_ALL_KEY) {
				nextName = STATUS_ALL_KEY;
			} else {
				const legacyMatch = stored.match(/^opt_\d+_(.*)$/);
				if (legacyMatch) {
					const raw = legacyMatch[1] === "blank" ? "" : legacyMatch[1];
					const candidate = raw ? matchByValue(raw) : undefined;
					if (candidate) {
						nextName = candidate.name;
					} else if (!raw) {
						nextName = STATUS_ALL_KEY;
					}
				}
			}
		}

		activeStatusName.value = nextName;
		ensureActiveStatusValid();
	}

	function rememberStatus(value: string) {
		const key = buildStatusStorageKey(source.value, activeTabName.value);
		const tabsArr = statusTabs.value || [];
		const entry = tabsArr.find((t: any) => t.name === value);
		if (!entry) {
			safeSetStorage(
				key,
				JSON.stringify({ name: STATUS_ALL_KEY, value: STATUS_ALL_KEY })
			);
			return;
		}
		const persistValue =
			entry.value === undefined || entry.value === null
				? STATUS_ALL_KEY
				: String(entry.value);
		safeSetStorage(
			key,
			JSON.stringify({ name: entry.name, value: persistValue })
		);
	}

	function updateQueryTypeByTab() {
		if (activeTabName.value === "a") query.value.type = "repair";
		else if (activeTabName.value === "b") query.value.type = "maintain";
		else query.value.type = "inspect";
	}

	function syncStateFromStorage() {
		const storedSource = safeGetStorage("source");
		if (storedSource === "1" || storedSource === "2") {
			source.value = storedSource as "1" | "2";
		}
		const storedType = safeGetStorage("type");
		if (["a", "b", "c"].includes(storedType)) {
			activeTabName.value = storedType as "a" | "b" | "c";
			updateQueryTypeByTab();
		}
		restoreStatusFromStorage(true);
	}

	async function initializeState() {
		isSettingUp = true;
		syncStateFromStorage();
		updateQueryTypeByTab();
		safeSetStorage("source", source.value);
		safeSetStorage("type", activeTabName.value);
		await loadDictionaries();
		nextTick(() => listRef.value?.reload?.());
		isSettingUp = false;
		hasInitialized = true;
	}

	onLoad((opts: Record<string, any>) => {
		const srcRaw = opts?.source;
		if (srcRaw === "1" || srcRaw === "2") {
			safeSetStorage("source", srcRaw);
		}
		const typeRaw = opts?.type;
		if (["a", "b", "c"].includes(typeRaw)) {
			safeSetStorage("type", typeRaw as "a" | "b" | "c");
			activeTabName.value = typeRaw as "a" | "b" | "c";
		} else {
			safeSetStorage("type", "a");
			activeTabName.value = "a";
		}
		initializeState();
	});

	watch(source, () => {
		if (isSettingUp) return;
		safeSetStorage("source", source.value);
		restoreStatusFromStorage(true);
		updateQueryTypeByTab();
		loadDictionaries().finally(() => {
			nextTick(() => listRef.value?.reload?.());
		});
	});

	async function request(params: {
		page: number;
		pageSize: number;
		query: { type: string; status: string; keyword: string };
		signal?: AbortSignal;
	}) {
		const { page, pageSize, query: q } = params;
		const keyword = (q?.keyword ?? "").trim();

		const status = (q?.status ?? "").toString();

		const isMine = source.value === "2";
		try {
			let raw: any;
			if (activeTabName.value === "a") {
				const payload: any = { pageNum: page, pageSize };
				if (source.value) payload.workOrderType = source.value;
				if (keyword) payload.equipmentCode = keyword;
				if (status) payload.orderStatus = status;
				raw = await getOrderList(payload);
			} else if (activeTabName.value === "b") {
				const payload: any = { pageNum: page, pageSize };
				if (source.value) payload.workOrderType = source.value;
				if (keyword) payload.mtNo = keyword;
				if (status) payload.formStatus = status;
				raw = await selectMaintainOrder(payload);
			} else {
				const payload: any = { pageNum: page, pageSize };
				if (keyword) payload.mtNo = keyword;
				if (status) payload.formStatus = status;
				raw = isMine
					? await selectMyOrderPageCheck(payload)
					: await selectOrderPageCheck(payload);
			}
			const { list, total } = extractPage(raw ?? {});
			console.log("[WorkOrderList] request result", { list, total });

			return { list, total };
		} catch (e) {
			console.error("[WorkOrderList] request error", e);
			throw e;
		}
	}

	function onTabChange() {
		updateQueryTypeByTab();
		safeSetStorage("type", activeTabName.value);
		restoreStatusFromStorage(true);
		nextTick(() => {
			listRef.value?.reload?.();
			uni.pageScrollTo({ scrollTop: 0, duration: 0 });
		});
	}

	function onStatusChange({ name }: { name: string }) {
		const tab = (statusTabs.value || []).find((t: any) => t.name === name);
		const nextStatus =
			tab && tab.value !== undefined && tab.value !== null
				? tab.value === STATUS_ALL_KEY
					? ""
					: String(tab.value)
				: "";
		query.value.status = nextStatus;
		rememberStatus(activeStatusName.value);
		nextTick(() => {
			listRef.value?.reload?.();
			uni.pageScrollTo({ scrollTop: 0, duration: 0 });
		});
	}

	watch(searchValue, (val) => {
		query.value.keyword = (val || "").trim();
		if (searchDebounceTimer.value) clearTimeout(searchDebounceTimer.value);
		searchDebounceTimer.value = setTimeout(() => {
			listRef.value?.reload?.();
		}, 300);
	});

	function getFormStatus(item: any) {
		const raw =
			item?.formStatus ??
			item?.status ??
			item?.orderStatus ??
			item?.documentStatus ??
			item?.workOrderStatus;
		return raw === undefined || raw === null ? "" : String(raw);
	}

	function resolveStatusText(item: any) {
		const status = getFormStatus(item);
		const tabsArr = statusTabs.value || [];
		const found = tabsArr.find(
			(t: any) => String(t.name) === status || String(t.value ?? "") === status
		);
		return found?.title || item?.statusText || item?.statusName || status;
	}

	function resolveCardTitle(item: any) {
		return item?.mtNo;
	}

	function formatLineTime(v?: string | number) {
		const formatted = formatDateTime(v);
		return formatted === "-" ? "" : formatted;
	}

	function resolveCardLines(item: any) {
		const lines: Array<{
			label: string;
			value: string;
			state?: string;
			className?: string;
			style?: any;
		}> = [];
		const pushLine = (
			label: string,
			value: any,
			options?: { state?: string; className?: string; style?: any }
		) => {
			if (value === undefined || value === null) return;
			const str = typeof value === "string" ? value.trim() : String(value);
			if (!str) return;
			lines.push({
				label,
				value: str,
				state: options?.state,
				className: options?.className,
				style: options?.style,
			});
		};
		const formatProgramNames = (input: any): string => {
			if (!input && input !== 0) return "-";
			if (Array.isArray(input)) {
				const names = input
					.map((name) =>
						typeof name === "string" ? name.trim() : String(name ?? "")
					)
					.filter(Boolean);
				return names.length ? names.join(", ") : "-";
			}
			return typeof input === "string" ? input : String(input);
		};

		const statusText = resolveStatusText(item);
		const statusCode = getFormStatus(item);
		const tab = activeTabName.value;
		if (tab === "a") {
			pushLine("设备编号", item?.equipmentCode || "-");
			pushLine("设备名称", item?.equipmentName || "-");
			pushLine("维修人", item?.orderExecutor || "-");
			if (statusText) {
				pushLine("工单状态", statusText, {
					state: resolveStatusState(statusText, statusCode),
				});
			}
			return lines;
		}
		if (tab === "b") {
			pushLine("设备编号", item?.equipmentCode || "-");
			pushLine("设备名称", item?.equipmentName || "-");
			pushLine("执行人", item?.orderExecutor || "-");
			pushLine("计划执行时间", item?.planTime || "-");
			pushLine(
				"计划工时(min)",
				item?.orPlanTime ? item?.orPlanTime + " " + "min" : "-"
			);
			pushLine("保养项目", formatProgramNames(item?.programName));

			if (item?.formStatus) {
				let ictStatus = statusTabs.value.find(
					(t: any) => t.value === item?.formStatus
				);

				if (ictStatus) {
					pushLine("工单状态", ictStatus.title, {
						state:
							ictStatus.value === "1"
								? "processing"
								: ictStatus.value === "2"
								? "warning"
								: ictStatus.value === "3"
								? "pending"
								: ictStatus.value === "4"
								? "success"
								: ictStatus.value === "5"
								? "fail"
								: "default",
					});
				}
			}
			return lines;
		}

		// tab === "c" 默认视为点检
		pushLine("设备编号", item?.equipmentCode || "-");
		pushLine("设备名称", item?.equipmentName || "-");
		pushLine("计划名称", item?.planName || "-");
		if (item?.formStatus) {
			let ictStatus = statusTabs.value.find(
				(t: any) => t.value === item?.formStatus
			);
			if (ictStatus) {
				console.log(ictStatus.value, "ictStatus");
				pushLine("工单状态", ictStatus.title, {
					state:
						ictStatus.value === "1"
							? "processing"
							: ictStatus.value === "2"
							? "warning"
							: ictStatus.value === "3"
							? "pending"
							: ictStatus.value === "4"
							? "success"
							: ictStatus.value === "5"
							? "fail"
							: "default",
				});
			}
		}
		pushLine("计划执行", item?.planTime || "-");
		return lines;
	}

	function resolveCardExtra(item: any) {
		const tab = activeTabName.value;
		if (tab === "a") {
			return item?.expectRepairTime;
		}
		if (tab === "b") {
			return "";
		}
		if (tab === "c") {
			return item?.createdTime;
		}
		return "";
	}

	function resolveApproveOrderCode(item: any) {
		return item?.mtNo || "-";
	}

	function resolveInitialPlanDate(item: any) {
		const candidates = [
			item?.planStartTime,
			item?.planTime,
			item?.planDate,
			item?.planMaintainTime,
			item?.planInspectTime,
			item?.expectRepairTime,
		];
		for (const candidate of candidates) {
			const formatted = formatDateYMD(candidate);
			if (formatted) return formatted;
		}
		const today = formatDateYMD(Date.now()) || formatDateYMD(new Date());
		return today || "";
	}

	function itemClosed(item: any) {
		const status = getFormStatus(item);
		const num = Number(status);
		if (!Number.isNaN(num)) return num >= 4;
		const text = resolveStatusText(item) || "";
		return /完成|关闭|终止|已办|已处理/.test(text);
	}

	function buildTags(item: any) {
		const tags: any[] = [];
		const statusText = resolveStatusText(item);
		if (statusText) tags.push({ text: statusText, type: "primary" });
		if (item?.mtNo) tags.push({ text: item.mtNo, type: "info" });
		if (item?.equipmentCode)
			tags.push({ text: item.equipmentCode, type: "info" });
		if (item?.workshopName)
			tags.push({ text: item.workshopName, type: "info" });
		return tags;
	}

	function makeActions(item: any) {
		const status = getFormStatus(item);
		const actions: any[] = [];
		if (activeTabName.value === "a") {
			if (source.value === "1") {
				if (status === "0")
					actions.push({ name: "派工", code: "dispatch", type: "primary" });
				if (status === "3")
					actions.push({ name: "审批", code: "approve", type: "primary" });
			} else {
				if (status === "1") {
					actions.push({ name: "接单", code: "accept", type: "primary" });
					actions.push({ name: "拒绝", code: "reject", type: "danger" });
				} else if (status === "2") {
					actions.push({ name: "维修", code: "maintain", type: "primary" });
				} else if (status === "4") {
					actions.push({
						name: "再次维修",
						code: "maintain-again",
						type: "primary",
					});
				}
			}
		} else if (activeTabName.value === "b") {
			if (source.value === "1") {
				if (status === "1")
					actions.push({ name: "派工", code: "dispatch", type: "primary" });
			} else {
				if (status === "2") {
					actions.push({ name: "接单", code: "accept", type: "primary" });
					actions.push({ name: "转单", code: "transfer", type: "danger" });
				} else if (status === "3") {
					actions.push({ name: "保养", code: "upkeep", type: "primary" });
				}
			}
		} else {
			if (source.value === "1") {
				if (status === "1")
					actions.push({ name: "派工", code: "dispatch", type: "primary" });
			} else {
				if (status === "2") {
					actions.push({ name: "接单", code: "accept", type: "primary" });
					actions.push({ name: "转单", code: "transfer", type: "danger" });
				} else if (status === "3") {
					actions.push({ name: "进入点检", code: "inspect", type: "primary" });
				} else if (status === "5") {
					actions.push({ name: "维保", code: "to-repair", type: "primary" });
				}
			}
		}
		return actions;
	}

	function handleActionClick(item: any, payload: any) {
		lastActionTime.value = Date.now();
		const code = payload?.code ?? payload?.item?.code;

		// 阻止事件冒泡，防止触发 handleCardClick
		const ev = payload?.ev;
		if (ev) {
			if (typeof ev.stopPropagation === "function") ev.stopPropagation();
			if (typeof ev.preventDefault === "function") ev.preventDefault();
		}

		switch (code) {
			case "dispatch":
				dispatch(item);
				break;
			case "approve":
				approve(item);
				break;
			case "accept":
				accept(item);
				break;
			case "reject":
				rejectOrder(item);
				break;
			case "maintain":
				maintain(item);
				break;
			case "maintain-again":
				maintain(item);
				break;
			case "transfer":
				openTransferDialog(item);
				break;
			case "upkeep":
				upkeep(item);
				break;
			case "inspect":
				inspect(item);
				break;
			case "to-repair":
				toRepair(item);
				break;
			default:
				break;
		}
	}

	function handleCardClick(item: any, ev?: any) {
		// 增加防抖时间到 300ms，确保按钮点击不会触发卡片点击
		if (Date.now() - lastActionTime.value < 300) {
			if (ev?.stopPropagation) ev.stopPropagation();
			return;
		}
		openDetail(item);
	}

	function dispatch(item: any) {
		// 点检工单派工
		if (activeTabName.value === "c") {
			pendingDispatchType.value = "inspect";
			pendingDispatchItem.value = item;
			dispatchPopoutVisible.value = true;
			return;
		}
		// 保养工单派工
		if (activeTabName.value === "b") {
			pendingDispatchType.value = "maintain";
			pendingDispatchItem.value = item;
			dispatchPopoutVisible.value = true;
			return;
		}
		// 维修工单派工
		pendingDispatchType.value = "repair";
		pendingDispatchItem.value = item;
		dispatchPopoutVisible.value = true;
	}
	// 审批工单
	function approve(item: any) {
		approveItem.value = item;
		approveContext.equipmentName = item?.equipmentName;
		approveContext.orderId = item?.id;
		approvePopoutVisible.value = true;
	}
	// 接单
	async function accept(item: any) {
		if (activeTabName.value === "a") {
			selectedItem.value = item;
			showTime.value = true;
			return;
		}
		loadingSubmit.value = true;
		try {
			if (activeTabName.value === "b") {
				await getWorkOrder({ id: item?.id });
				uni.showToast({ title: "已接单", icon: "success" });
			} else {
				await inspectWorkOrder({ id: item?.id });
				uni.showToast({ title: "已接单", icon: "success" });
			}
			listRef.value?.reload?.();
		} catch (e) {
			const msg =
				e?.msg || e?.message || e?.raw?.msg || e?.data?.msg || "操作失败";
			uni.showToast({ title: msg, icon: "none" });
		} finally {
			loadingSubmit.value = false;
		}
	}
	// 拒绝工单
	function rejectOrder(item: any) {
		selectedItem.value = item;
		reasonType.value = 1;
		showRemark.value = true;
	}
	// 转单
	function openTransferDialog(item: any) {
		selectedItem.value = item;
		reasonType.value = 3;
		showRemark.value = true;
	}
	// 进入点检
	function inspect(item: any) {
		const mtNo = item?.mtNo;
		if (!mtNo) {
			uni.showToast({ title: "缺少工单信息", icon: "none" });
			return;
		}
		const id = item?.id ?? item?.orderId ?? item?.workOrderId ?? "";
		const type = getFormStatus(item);

		inspectContext.value = {
			id: id ? String(id) : "",
			mtNo: String(mtNo),
			equipmentName: item?.equipmentName || "",
			equipmentCode: item?.equipmentCode || "",
			equipmentModel: item?.equipmentModel || "",
			type: type,
		};
		inspectPopoutVisible.value = true;
	}
	// 维保
	function toRepair(item: any) {
		const url = buildUrl("/pages/eqManagement/repair/index", {
			mtNo: item?.mtNo ?? "",
			eqCode: item?.equipmentCode ?? "",
			eqName: item?.equipmentName ?? "",
		}, { skipEmpty: true });
		uni.navigateTo({ url });
	}
	// 保养确定
	async function handleUpkeepBeforeClose(payload?: {
		orderId: string;
		actualHour: string;
		finishTime: string;
		startTime: string;
		jneSeSpareConnectionList: any[];
	}) {
		approveLoading.value = true;
		uni.showLoading({ title: "提交中...", mask: true });
		try {
			await submitOrder({
				id: payload?.orderId,
				actualHour: payload?.actualHour,
				startTime: payload?.startTime,
				finishTime: payload?.finishTime,
				jneSeSpareConnectionList: payload?.jneSeSpareConnectionList,
			});
			uni.showToast({ title: "操作成功", icon: "success" });
			resetApproveState();
			listRef.value?.reload?.();
			return true;
		} catch (error: any) {
			console.warn("[WorkOrderList] approve failed", error);
			const msg =
				error?.msg ||
				error?.message ||
				error?.raw?.msg ||
				error?.data?.msg ||
				"审批失败";
			uni.showToast({ title: msg, icon: "none" });
			return Promise.reject(false);
		} finally {
			approveLoading.value = false;
			uni.hideLoading();
		}
	}
	// 保养工单保养
	function upkeep(item: any) {
		approveItem.value = item;
		approveContext.equipmentName = item?.equipmentName;
		approveContext.orderId = item?.id;
		upkeepPopoutVisible.value = true;
	}
	// 维修工单 & 再次维修
	function maintain(item: any) {
		// 防止重复调用
		const now = Date.now();
		if (now - lastMaintainTime.value < maintainDebounceTime) {
			console.log("[maintain] 防抖拦截重复调用");
			return;
		}
		lastMaintainTime.value = now;

		console.log("3333", item);

		const orderId = item?.id ?? item?.orderId ?? item?.workOrderId;
		if (!orderId) {
			uni.showToast({ title: "缺少工单信息", icon: "none" });
			return;
		}
		const url = buildUrl("/pages/maintainOrder/index", {
			id: String(orderId),
			source: source.value,
			mode: "repair",
		}, { skipEmpty: true });
		uni.navigateTo({ url });
	}

	function onLoaded(_payload: any) {}

	function onError(e: any) {
		console.warn("[WorkOrderList] load error", e);
	}

	function openDetail(item: any) {
		if (activeTabName.value === "a") {
			const url = buildUrl("/pages/workOrderDetail/index", {
				id: item?.id ?? "",
				source: source.value,
			}, { skipEmpty: true });
			uni.navigateTo({ url });
			return;
		}
		if (activeTabName.value === "b") {
			const url = buildUrl("/pages/upkeepOrderDetail/index", {
				id: item?.id ?? "",
			}, { skipEmpty: true });
			uni.navigateTo({ url });
			return;
		}
		const url = buildUrl("/pages/inspectionDetail/index", {
			mtNo: item?.mtNo ?? "",
			type: getFormStatus(item),
			source: source.value,
			equipmentModel: item?.equipmentModel ?? "",
			isView: "1",
		}, { skipEmpty: true });
		uni.navigateTo({ url });
	}

	watch(dispatchPlanVisible, (visible) => {
		if (!visible) {
			dispatchPlanDate.value = "";
			if (!dispatchPopoutVisible.value) {
				pendingDispatchItem.value = null;
				pendingDispatchType.value = null;
				selectedDispatchUser.value = null;
			}
		}
	});

	watch(dispatchPopoutVisible, (visible) => {
		if (!visible) {
			dispatchSelected.value = undefined;
			if (!dispatchPlanVisible.value) {
				pendingDispatchItem.value = null;
				pendingDispatchType.value = null;
				selectedDispatchUser.value = null;
			}
		}
	});

	watch(inspectPopoutVisible, (visible) => {
		if (!visible) {
			inspectContext.value = null;
		}
	});

	async function beforeCloseDispatchPlan(payload?: {
		planTime: "";
		userName: "";
		userId: "";
	}) {
		dispatching.value = true;
		try {
			if (pendingDispatchType.value === "maintain") {
				// 保养派工
				await issueOrder({
					id: pendingDispatchItem.value.id,
					orderExecutorId: payload?.userId,
					orderExecutorName: payload?.userName,
					planTime: payload?.planTime,
				});
			} else if (pendingDispatchType.value === "inspect") {
				let newUserName = payload?.userName.split("，");

				let userIds = newUserName.map((name, index) => {
					return {
						orderExecutorName: name.trim(),
						orderExecutorId: payload?.userId[index],
					};
				});

				// 点检派工
				await inspectIssueOrderList({
					// id: pendingDispatchItem.value.id,
					dataList: [pendingDispatchItem.value.mtNo],
					planTime: payload?.planTime,
					equipmentCheckOrderExecutorList: userIds,
				});
			} else {
				// 维修派工
				await equipmentRepairdispatch({
					id: pendingDispatchItem.value.id,
					userId: payload?.userId,
					userName: payload.userName,
				});
			}
			uni.showToast({ title: "派工成功", icon: "success" });
			dispatchPopoutVisible.value = false;
			listRef.value?.reload?.();
			pendingDispatchItem.value = null;
			return true;
		} catch (error: any) {
			console.warn("[WorkOrderList] dispatch with plan failed", error);
			const msg = error?.msg || error?.message || error?.raw?.msg || "派工失败";
			uni.showToast({ title: msg, icon: "none" });
			return Promise.reject(false);
		} finally {
			dispatching.value = false;
		}
	}

	async function handleInspectBeforeClose(payload?: {
		// id: string;
		mtNo: string;
		equipmentName: string;
		equipmentCode: string;
		equipmentModel?: string;
		checkTime?: string;
		checkDetailList: Array<any>;
	}) {
		if (!payload) {
			uni.showToast({ title: "缺少点检信息", icon: "none" });
			return Promise.reject(false);
		}
		inspectSubmitting.value = true;
		try {
			// 调用点检提交接口
			await commitCheckMission(payload);
			uni.showToast({ title: "点检提交成功", icon: "success" });
			inspectPopoutVisible.value = false;
			listRef.value?.reload?.();
			return true;
		} catch (error: any) {
			console.warn("[WorkOrderList] inspect submit failed", error);
			const msg =
				error?.msg || error?.message || error?.raw?.msg || "点检提交失败";
			uni.showToast({ title: msg, icon: "none" });
			return Promise.reject(false);
		} finally {
			inspectSubmitting.value = false;
		}
	}

	function onDispatchPlanChange(v: any) {
		dispatchPlanDate.value = formatDateYMD(v) || "";
	}

	function resetApproveState() {
		approveItem.value = null;
		approveSelection.value = "pass";
		approveRemark.value = "";
		approveContext.orderCode = "-";
		approveContext.equipmentName = "-";
		approveContext.orderId = "";
	}

	// 维修工单审批
	async function beforeCloseApprove(payload?: {
		orderIds: string;
		equipmentRepairauditing: any;
	}) {
		approveLoading.value = true;
		uni.showLoading({ title: "提交中...", mask: true });
		try {
			await equipmentRepairauditing(payload);
			uni.showToast({ title: "审批成功", icon: "success" });
			resetApproveState();
			listRef.value?.reload?.();
			return true;
		} catch (error: any) {
			console.warn("[WorkOrderList] approve failed", error);
			const msg =
				error?.msg ||
				error?.message ||
				error?.raw?.msg ||
				error?.data?.msg ||
				"审批失败";
			uni.showToast({ title: msg, icon: "none" });
			return Promise.reject(false);
		} finally {
			approveLoading.value = false;
			uni.hideLoading();
		}
	}

	function onPlanDateChange(v: any) {
		tempPlanDate.value = formatDateYMD(v) || "";
		tempPlanTime.value = "";
	}
	// 接单
	async function beforeCloseTime(payload?: { repairDate: string }) {
		loadingSubmit.value = true;
		try {
			await requestOrder({
				id: selectedItem.value.id,
				repairDate: payload?.repairDate,
			});
			uni.showToast({ title: "已接单", icon: "success" });
			listRef.value?.reload?.();
			return true;
		} catch (e) {
			console.warn("accept failed", e);
			// uni.showToast({ title: "接单失败", icon: "none" });
			const msg =
				error?.msg ||
				error?.message ||
				error?.raw?.msg ||
				error?.data?.msg ||
				"接单失败";
			uni.showToast({ title: msg, icon: "none" });
			return Promise.reject(false);
		} finally {
			loadingSubmit.value = false;
		}
	}
	// 拒绝 &转单  b 保养转单 c 点检转单
	async function beforeCloseReject(
		payload?: {
			id: string;
			rejectReason: string;
		},
		reasonType?: any
	) {
		loadingSubmit.value = true;

		if (reasonType === 1) {
			try {
				await requestOrder({
					id: selectedItem.value.id,
					refuseDetail: payload.rejectReason,
				});
				uni.showToast({ title: "已提交", icon: "success" });
				listRef.value?.reload?.();
				return true;
			} catch (e) {
				// uni.showToast({ title: "提交失败", icon: "none" });
				const msg =
					error?.msg ||
					error?.message ||
					error?.raw?.msg ||
					error?.data?.msg ||
					"提交失败";
				uni.showToast({ title: msg, icon: "none" });
				return Promise.reject(false);
			} finally {
				loadingSubmit.value = false;
			}
		} else if (reasonType === 3) {
			if (activeTabName.value == "b") {
				try {
					await transferOrderAPI({
						id: selectedItem.value.id,
						causeDetails: payload?.rejectReason.trim(),
					});

					uni.showToast({ title: "已转单", icon: "success" });
					listRef.value?.reload?.();
					return true;
				} catch (e) {
					// uni.showToast({ title: "转单失败", icon: "none" });
					const msg =
						error?.msg ||
						error?.message ||
						error?.raw?.msg ||
						error?.data?.msg ||
						"转单失败";
					uni.showToast({ title: msg, icon: "none" });
					return Promise.reject(false);
				} finally {
					loadingSubmit.value = false;
				}
			} else if (activeTabName.value == "c") {
				try {
					await inspectTransferOrderAPI({
						id: selectedItem.value.id,
						causeDetails: payload?.rejectReason.trim(),
					});
					uni.showToast({ title: "已转单", icon: "success" });
					listRef.value?.reload?.();
					return true;
				} catch (e) {
					// uni.showToast({ title: "转单失败", icon: "none" });
					const msg =
						error?.msg ||
						error?.message ||
						error?.raw?.msg ||
						error?.data?.msg ||
						"转单失败";
					uni.showToast({ title: msg, icon: "none" });
					return Promise.reject(false);
				} finally {
					loadingSubmit.value = false;
				}
			}
		}
	}

	onShow(() => {
		// 第一次 onShow 跳过，因为 onLoad 中已经处理了初始化
		if (isFirstShow) {
			isFirstShow = false;
			return;
		}

		if (!hasInitialized) return;
		const prevTab = activeTabName.value;
		const prevStatus = activeStatusName.value;
		updateQueryTypeByTab();
		loadDictionaries()
			.catch((err) => {
				console.warn("[WorkOrderList] onShow loadDictionaries fail", err);
			})
			.finally(() => {
				if (activeTabName.value !== prevTab) {
					activeTabName.value = prevTab;
				}
				if (activeStatusName.value !== prevStatus) {
					activeStatusName.value = prevStatus;
				}
				ensureActiveStatusValid();
				if (listRef.value) {
					listRef.value.reload?.();
				}
			});
	});

	// 清理定时器，防止内存泄漏
	onUnmounted(() => {
		if (searchDebounceTimer.value) {
			clearTimeout(searchDebounceTimer.value);
			searchDebounceTimer.value = null;
		}
	});

	return {
		tabs,
		source,
		activeTabName,
		activeStatusName,
		statusTabs,
		searchValue,
		query,
		listRef,
		listHeight,
		pageSize,
		request,
		onTabChange,
		onStatusChange,
		onLoaded,
		onError,
		resolveCardTitle,
		resolveCardExtra,
		resolveCardLines,
		itemClosed,
		makeActions,
		handleActionClick,
		handleCardClick,
		dispatchSelected,
		dispatchPopoutVisible,
		dispatchOptions,
		dispatchPlanDate,
		dispatchPlanVisible,
		beforeCloseDispatchPlan,
		onDispatchPlanChange,
		tempPlanDate,
		showTime,
		beforeCloseTime,
		onPlanDateChange,
		remark,
		showRemark,
		beforeCloseReject,
		causeDetails,
		showCauseDetails,
		// beforeCloseTransfer,
		approvePopoutVisible,
		upkeepPopoutVisible,
		approveContext,
		approveSelection,
		approveRemark,
		beforeCloseApprove,
		handleUpkeepBeforeClose,
		inspectPopoutVisible,
		inspectContext,
		handleInspectBeforeClose,
		inspectLoading,
		pendingDispatchType,
		reasonType,
	};
}
