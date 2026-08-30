// SPDX-License-Identifier: Apache-2.0

import Foundation

struct DSHVersion: Comparable, Codable, Hashable, CustomStringConvertible {
    let major: Int
    let minor: Int
    let patch: Int
    let prerelease: [String]

    init?(_ raw: String) {
        var value = raw
        if value.hasPrefix("dsh-v") { value.removeFirst(5) }
        let withoutBuild = value.split(separator: "+", maxSplits: 1).first.map(String.init) ?? value
        let pieces = withoutBuild.split(separator: "-", maxSplits: 1).map(String.init)
        let core = pieces[0].split(separator: ".", omittingEmptySubsequences: false)
        guard core.count == 3,
              let major = Int(core[0]), let minor = Int(core[1]), let patch = Int(core[2]),
              major >= 0, minor >= 0, patch >= 0 else { return nil }
        let prerelease = pieces.count == 2
            ? pieces[1].split(separator: ".", omittingEmptySubsequences: false).map(String.init)
            : []
        guard !prerelease.contains(where: { $0.isEmpty || !$0.allSatisfy({ $0.isLetter || $0.isNumber || $0 == "-" }) }) else { return nil }
        self.major = major
        self.minor = minor
        self.patch = patch
        self.prerelease = prerelease
    }

    var description: String {
        let core = "\(major).\(minor).\(patch)"
        return prerelease.isEmpty ? core : core + "-" + prerelease.joined(separator: ".")
    }

    var isPrerelease: Bool { !prerelease.isEmpty }

    func accepts(candidate: DSHVersion) -> Bool {
        candidate > self && (isPrerelease || !candidate.isPrerelease)
    }

    static func < (lhs: DSHVersion, rhs: DSHVersion) -> Bool {
        let leftCore = [lhs.major, lhs.minor, lhs.patch]
        let rightCore = [rhs.major, rhs.minor, rhs.patch]
        if leftCore != rightCore { return leftCore.lexicographicallyPrecedes(rightCore) }
        if lhs.prerelease.isEmpty { return false }
        if rhs.prerelease.isEmpty { return true }
        for index in 0..<min(lhs.prerelease.count, rhs.prerelease.count) {
            let left = lhs.prerelease[index]
            let right = rhs.prerelease[index]
            if left == right { continue }
            if let leftNumber = Int(left), let rightNumber = Int(right) { return leftNumber < rightNumber }
            if Int(left) != nil { return true }
            if Int(right) != nil { return false }
            return left < right
        }
        return lhs.prerelease.count < rhs.prerelease.count
    }
}
