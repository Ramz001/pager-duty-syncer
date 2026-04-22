export function mapSeverity(priority) {
  switch ((priority || "").toLowerCase()) {
    case "urgent":
      return "critical";
    case "high":
      return "error";
    case "medium":
      return "warning";
    case "low":
    default:
      return "info";
  }
}
