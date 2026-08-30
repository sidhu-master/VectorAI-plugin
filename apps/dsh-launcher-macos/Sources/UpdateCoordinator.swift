// SPDX-License-Identifier: Apache-2.0

import Foundation

enum UpdateToolbarStatus: Equatable {
    case idle
    case checking
    case current
    case available(DSHVersion)
    case installing(String)
    case failed(String)
}

struct UpdateToolbarState: Equatable {
    var currentVersion: DSHVersion
    var status: UpdateToolbarStatus = .idle

    var buttonTitle: String { "DSH \(currentVersion)" }
    var showsUpdateDot: Bool {
        if case .available = status { return true }
        return false
    }
}

enum RuntimeHealth {
    case healthy
    case serverUnavailable
    case pluginTreeUnavailable
}

enum UpdateTransaction {
    static func resolve(health: RuntimeHealth, registry: RuntimeRegistry) throws {
        switch health {
        case .healthy: try registry.confirmCandidate()
        case .serverUnavailable, .pluginTreeUnavailable: try registry.rollbackCandidate()
        }
    }
}
