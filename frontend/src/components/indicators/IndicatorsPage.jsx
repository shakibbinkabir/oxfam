import { useState, useCallback } from "react";
import IndicatorTable from "./IndicatorTable";
import IndicatorForm from "./IndicatorForm";

export default function IndicatorsPage() {
  const [showForm, setShowForm] = useState(false);
  const [editIndicator, setEditIndicator] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleEdit = useCallback((indicator) => {
    setEditIndicator(indicator);
    setShowForm(true);
  }, []);

  const handleCreate = useCallback(() => {
    setEditIndicator(null);
    setShowForm(true);
  }, []);

  const handleClose = useCallback(() => {
    setShowForm(false);
    setEditIndicator(null);
  }, []);

  const handleSaved = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Climate Indicators</h1>
      <IndicatorTable
        key={refreshKey}
        onEdit={handleEdit}
        onCreate={handleCreate}
      />
      {showForm && (
        <IndicatorForm
          indicator={editIndicator}
          onClose={handleClose}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
