import SwiftUI
import Charts

struct SparklineView: View {
    let values: [Double]
    let color: Color
    let height: CGFloat

    init(values: [Double], color: Color = .green, height: CGFloat = 30) {
        self.values = values
        self.color = color
        self.height = height
    }

    var body: some View {
        if values.isEmpty {
            Rectangle()
                .fill(Color.secondary.opacity(0.1))
                .frame(height: height)
        } else {
            Chart {
                ForEach(Array(values.enumerated()), id: \.offset) { index, value in
                    LineMark(
                        x: .value("Index", index),
                        y: .value("Value", value)
                    )
                    .foregroundStyle(color)
                    .interpolationMethod(.catmullRom)

                    AreaMark(
                        x: .value("Index", index),
                        y: .value("Value", value)
                    )
                    .foregroundStyle(
                        LinearGradient(
                            colors: [color.opacity(0.2), color.opacity(0.0)],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )
                    .interpolationMethod(.catmullRom)
                }
            }
            .chartXAxis(.hidden)
            .chartYAxis(.hidden)
            .chartYScale(domain: 0 ... max(values.max() ?? 100, 1))
            .frame(height: height)
        }
    }
}
