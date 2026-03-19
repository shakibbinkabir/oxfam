import { createContext, useContext, useReducer, useCallback } from "react";

const MapContext = createContext(null);

const ADMIN_LEVEL_LABELS = { 1: "Division", 2: "District", 3: "Upazila", 4: "Union" };

const initialState = {
  level: 1,
  indicator: "cri",
  selectedPcode: null,
  selectedFeature: null,
  drillHistory: [],
  parentPcode: null,
};

function reducer(state, action) {
  switch (action.type) {
    case "SET_INDICATOR":
      return { ...state, indicator: action.payload };
    case "SELECT_FEATURE":
      return { ...state, selectedPcode: action.payload?.pcode || null, selectedFeature: action.payload };
    case "CLEAR_SELECTION":
      return { ...state, selectedPcode: null, selectedFeature: null };
    case "DRILL_DOWN": {
      if (state.level >= 4) return state;
      const historyEntry = { level: state.level, parentPcode: state.parentPcode };
      return {
        ...state,
        drillHistory: [...state.drillHistory, historyEntry],
        level: state.level + 1,
        parentPcode: action.payload,
        selectedPcode: null,
        selectedFeature: null,
      };
    }
    case "DRILL_UP": {
      if (state.drillHistory.length === 0) return state;
      const history = [...state.drillHistory];
      const prev = history.pop();
      return {
        ...state,
        drillHistory: history,
        level: prev.level,
        parentPcode: prev.parentPcode,
        selectedPcode: null,
        selectedFeature: null,
      };
    }
    case "RESET_VIEW":
      return { ...initialState, indicator: state.indicator };
    default:
      return state;
  }
}

export function MapProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const setIndicator = useCallback((ind) => dispatch({ type: "SET_INDICATOR", payload: ind }), []);
  const selectFeature = useCallback((feature) => dispatch({ type: "SELECT_FEATURE", payload: feature }), []);
  const clearSelection = useCallback(() => dispatch({ type: "CLEAR_SELECTION" }), []);
  const drillDown = useCallback((pcode) => dispatch({ type: "DRILL_DOWN", payload: pcode }), []);
  const drillUp = useCallback(() => dispatch({ type: "DRILL_UP" }), []);
  const resetView = useCallback(() => dispatch({ type: "RESET_VIEW" }), []);

  const value = {
    ...state,
    levelLabel: ADMIN_LEVEL_LABELS[state.level],
    canDrillDown: state.level < 4,
    canDrillUp: state.drillHistory.length > 0,
    setIndicator,
    selectFeature,
    clearSelection,
    drillDown,
    drillUp,
    resetView,
  };

  return <MapContext.Provider value={value}>{children}</MapContext.Provider>;
}

export default function useMapContext() {
  const ctx = useContext(MapContext);
  if (!ctx) throw new Error("useMapContext must be used within MapProvider");
  return ctx;
}
