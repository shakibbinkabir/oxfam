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
  simulationModalOpen: false,
  simulationPcode: null,
  simulationResult: null,
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
    case "OPEN_SIMULATION":
      return { ...state, simulationModalOpen: true, simulationPcode: action.payload };
    case "CLOSE_SIMULATION":
      return { ...state, simulationModalOpen: false, simulationPcode: null };
    case "SET_SIMULATION_RESULT":
      return { ...state, simulationResult: action.payload };
    case "CLEAR_SIMULATION":
      return { ...state, simulationResult: null, simulationModalOpen: false, simulationPcode: null };
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
  const openSimulation = useCallback((pcode) => dispatch({ type: "OPEN_SIMULATION", payload: pcode }), []);
  const closeSimulation = useCallback(() => dispatch({ type: "CLOSE_SIMULATION" }), []);
  const setSimulationResult = useCallback((result) => dispatch({ type: "SET_SIMULATION_RESULT", payload: result }), []);
  const clearSimulation = useCallback(() => dispatch({ type: "CLEAR_SIMULATION" }), []);

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
    openSimulation,
    closeSimulation,
    setSimulationResult,
    clearSimulation,
  };

  return <MapContext.Provider value={value}>{children}</MapContext.Provider>;
}

export default function useMapContext() {
  const ctx = useContext(MapContext);
  if (!ctx) throw new Error("useMapContext must be used within MapProvider");
  return ctx;
}
