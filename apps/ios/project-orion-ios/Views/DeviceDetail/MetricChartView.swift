import SwiftUI
import Charts

struct MetricChartView: View {
    let title: String
    let unit: String
    let points: [(date: Date, value: Double)]
    let color: Color
    let maxY: Double?

    init(title: String, unit: String = "%", points: [(date: Date, value: Double)], color: Color = .green, maxY: Double? = nil) {
        self.title = title
        self.unit = unit
        self.points = points
        self.color = color
        self.maxY = maxY
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(title.uppercased())
                    .font(.caption2.bold())
                    .tracking(1)
                    .foregroundStyle(.secondary)

                Spacer()

                if let last = points.last {
                    Text("\(last.value, specifier: "%.1f")\(unit)")
                        .font(.caption.bold().monospacedDigit())
                        .foregroundStyle(color)
                }
            }

            if points.isEmpty {
                Rectangle()
                    .fill(Color.secondary.opacity(0.1))
                    .frame(height: 120)
                    .overlay {
                        Text("No data")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
            } else {
                Chart {
                    ForEach(Array(points.enumerated()), id: \.offset) { _, point in
                        LineMark(
                            x: .value("Time", point.date),
                            y: .value("Value", point.value)
                        )
                        .foregroundStyle(color)
                        .interpolationMethod(.catmullRom)

                        AreaMark(
                            x: .value("Time", point.date),
                            y: .value("Value", point.value)
                        )
                        .foregroundStyle(
                            LinearGradient(
                                colors: [color.opacity(0.25), color.opacity(0.0)],
                                startPoint: .top,
                                endPoint: .bottom
                            )
                        )
                        .interpolationMethod(.catmullRom)
                    }
                }
                .chartYScale(domain: 0 ... (maxY ?? max(points.map(\.value).max() ?? 100, 1)))
                .chartXAxis {
                    AxisMarks(values: .automatic(desiredCount: 5)) { _ in
                        AxisGridLine(stroke: StrokeStyle(lineWidth: 0.3))
                            .foregroundStyle(.secondary.opacity(0.3))
                        AxisValueLabel(format: .dateTime.hour().minute())
                            .foregroundStyle(.secondary)
                            .font(.system(size: 8))
                    }
                }
                .chartYAxis {
                    AxisMarks(position: .leading, values: .automatic(desiredCount: 4)) { _ in
                        AxisGridLine(stroke: StrokeStyle(lineWidth: 0.3))
                            .foregroundStyle(.secondary.opacity(0.3))
                        AxisValueLabel()
                            .foregroundStyle(.secondary)
                            .font(.system(size: 8))
                    }
                }
                .frame(height: 120)
            }
        }
        .padding(12)
        .background(Color(.secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }
}
