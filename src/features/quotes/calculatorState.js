const getInitialBaseId = () => {
  const savedBase = localStorage.getItem('dispatch_default_base');
  return savedBase || '';
};



export const initialState = {
  activeTab: 'calculator',
  selectedBaseId: getInitialBaseId(),
  selectedTruckClassId: '',
  waypoints: ['', ''],
  isAfterHours: false,
  isRoadClub: false,
  isMetro: false,
  isHazard: false,
  activeOverrides: { afterHours: true, roadClub: true, metro: true, hazard: true, customSurcharges: {} },
  pendingCustomSurcharges: {},
  showDetails: false,
  customerName: '',
  customerPhone: '',
  quoteMake: '',
  quoteModel: '',
  quoteNotes: '',
  customRateInput: '',
  customLoadUnloadMins: '',
  customDriveTimeBufferPercent: '',
};

export function appReducer(state, action) {
  switch (action.type) {
    case 'SET_TAB':
      return { ...state, activeTab: action.payload };
    case 'SET_BASE':
      return { ...state, selectedBaseId: action.payload };
    case 'SET_TRUCK_CLASS':
      return { ...state, selectedTruckClassId: action.payload };
    case 'SET_WAYPOINTS':
      return { ...state, waypoints: Array.isArray(action.payload) ? action.payload : ['', ''] };
    case 'UPDATE_WAYPOINT': {
      const currentWaypoints = Array.isArray(state.waypoints) ? state.waypoints : ['', ''];
      const next = [...currentWaypoints];
      next[action.payload.index] = action.payload.value;
      return { ...state, waypoints: next };
    }
    case 'ADD_WAYPOINT': {
      const currentWaypoints = Array.isArray(state.waypoints) ? state.waypoints : ['', ''];
      return { ...state, waypoints: [...currentWaypoints, ''] };
    }
    case 'REMOVE_WAYPOINT': {
      const currentWaypoints = Array.isArray(state.waypoints) ? state.waypoints : ['', ''];
      if (currentWaypoints.length <= 2) return state;
      const next = currentWaypoints.filter((_, idx) => idx !== action.payload);
      return { ...state, waypoints: next };
    }
    case 'TOGGLE_SURCHARGE':
      return { ...state, [action.payload]: !state[action.payload] };
    case 'SET_OVERRIDE':
      return {
        ...state,
        activeOverrides: {
          ...state.activeOverrides,
          [action.payload.key]: action.payload.value,
        },
      };
    case 'TOGGLE_DETAILS':
      return { ...state, showDetails: !state.showDetails };
    case 'SET_CUSTOMER_INFO':
      return { ...state, [action.payload.field]: action.payload.value };
    case 'SET_QUOTE_META_FIELDS':
      return { ...state, ...action.payload };
    case 'SET_CUSTOM_RATE':
      return { ...state, customRateInput: action.payload };
    case 'RESET_QUOTE_OVERRIDES':
      if (state.restoreQuoteOverrides) return { ...state, restoreQuoteOverrides: false };
      return { ...state, customRateInput: '', customLoadUnloadMins: '', customDriveTimeBufferPercent: '' };
    case 'SET_CUSTOM_DRIVE_BUFFER':
      return { ...state, customDriveTimeBufferPercent: action.payload };
    case 'SET_CUSTOM_LOAD_UNLOAD':
      return { ...state, customLoadUnloadMins: action.payload };
    case 'SET_PENDING_CUSTOM_SURCHARGES':
      return { ...state, pendingCustomSurcharges: action.payload };
    case 'LOAD_LOGGED_QUOTE':
      return {
        ...state,
        activeTab: 'calculator',
        restoreQuoteOverrides: true,
        customRateInput: action.payload.quote_details?.pricingOverrides?.customRate ?? '',
        customLoadUnloadMins: action.payload.quote_details?.pricingOverrides?.customLoadUnloadMins ?? '',
        customDriveTimeBufferPercent: action.payload.quote_details?.pricingOverrides?.customDriveTimeBufferPercent ?? '',
        selectedBaseId: action.payload.base_yard_id || '',
        selectedTruckClassId: action.payload.truck_class || '',
        waypoints: Array.isArray(action.payload.all_waypoints) && action.payload.all_waypoints.length >= 2
          ? action.payload.all_waypoints
          : [action.payload.pickup_address || '', action.payload.dropoff_address || ''],
        customerName: action.payload.customer_name || '',
        customerPhone: action.payload.customer_phone || '',
        quoteMake: action.payload.quote_details?.make || '',
        quoteModel: action.payload.quote_details?.model || '',
        quoteNotes: action.payload.notes || '',
      };
    case 'RESET_FORM':
      return {
        ...initialState,
        waypoints: ['', ''],
        activeTab: state.activeTab,
        selectedBaseId: state.selectedBaseId,
      };
    default:
      return state;
  }
}

