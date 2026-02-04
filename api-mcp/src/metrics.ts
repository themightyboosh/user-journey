import { JourneyMap, CellObject, DerivedMetricsObject, CompletionStatusObject } from './types';

export function calculateMetrics(journey: JourneyMap): DerivedMetricsObject {
  const totalPhases = journey.phases.length;
  const totalSwimlanes = journey.swimlanes.length;
  const totalCellsExpected = totalPhases * totalSwimlanes;
  const totalCellsPresent = journey.cells.length;

  const totalCellsCompleted = journey.cells.filter(cell => isCellComplete(cell)).length;

  const percentCellsComplete = totalCellsExpected > 0
    ? (totalCellsCompleted / totalCellsExpected) * 100
    : 0;

  return {
    totalPhases,
    totalSwimlanes,
    totalCellsExpected,
    totalCellsPresent,
    totalCellsCompleted,
    percentCellsComplete,
  };
}

export function isCellComplete(cell: CellObject): boolean {
  return cell.action.trim().length > 0 && cell.context.trim().length > 0;
}

export function calculateCompletionStatus(journey: JourneyMap): CompletionStatusObject {
    const metrics = calculateMetrics(journey);
    return {
        name: journey.name.trim().length > 0 && journey.name !== "Draft", // Basic check
        role: journey.role.trim().length > 0,
        context: journey.context.trim().length > 0,
        phases: journey.phases.length >= 1 && journey.arePhasesComplete,
        swimlanes: journey.swimlanes.length >= 1 && journey.areSwimlanesComplete,
        cells: metrics.percentCellsComplete === 100 && metrics.totalCellsExpected > 0
    };
}

export function recalculateJourney(journey: JourneyMap): JourneyMap {
    const metrics = calculateMetrics(journey);
    const completionStatus = calculateCompletionStatus(journey);
    
    return {
        ...journey,
        metrics,
        completionStatus,
        updatedAt: new Date().toISOString(),
        version: journey.version + 1
    };
}
