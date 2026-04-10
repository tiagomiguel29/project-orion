import Foundation

enum APIError: LocalizedError {
    case noServerURL
    case invalidURL
    case httpError(statusCode: Int, message: String)
    case decodingError(Error)
    case networkError(Error)
    case noData

    var errorDescription: String? {
        switch self {
        case .noServerURL:
            return "Server URL not configured"
        case .invalidURL:
            return "Invalid URL"
        case .httpError(let code, let message):
            return "HTTP \(code): \(message)"
        case .decodingError(let error):
            return "Failed to decode response: \(error.localizedDescription)"
        case .networkError(let error):
            return error.localizedDescription
        case .noData:
            return "No data returned"
        }
    }
}

actor APIClient {
    static let shared = APIClient()

    private let decoder: JSONDecoder = {
        let d = JSONDecoder()
        return d
    }()

    private let encoder: JSONEncoder = {
        let e = JSONEncoder()
        return e
    }()

    var baseURL: String {
        ServerConfig.serverURL ?? ""
    }

    // MARK: - Generic Request

    private func request<T: Codable>(
        method: String,
        path: String,
        body: (any Codable)? = nil,
        token: String? = nil,
        queryItems: [URLQueryItem]? = nil
    ) async throws -> T {
        guard !baseURL.isEmpty else { throw APIError.noServerURL }

        var urlComponents = URLComponents(string: baseURL + path)
        if let queryItems {
            urlComponents?.queryItems = queryItems
        }
        guard let url = urlComponents?.url else { throw APIError.invalidURL }

        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        if let token {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        if let body {
            request.httpBody = try encoder.encode(body)
        }

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await URLSession.shared.data(for: request)
        } catch {
            throw APIError.networkError(error)
        }

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.networkError(URLError(.badServerResponse))
        }

        if httpResponse.statusCode >= 400 {
            // Try to parse error message from backend
            if let baseResp = try? decoder.decode(BaseResponse<EmptyCodable>.self, from: data) {
                throw APIError.httpError(statusCode: httpResponse.statusCode, message: baseResp.message)
            }
            throw APIError.httpError(statusCode: httpResponse.statusCode, message: "Request failed")
        }

        do {
            let baseResponse = try decoder.decode(BaseResponse<T>.self, from: data)
            guard let result = baseResponse.data else { throw APIError.noData }
            return result
        } catch let error as APIError {
            throw error
        } catch {
            throw APIError.decodingError(error)
        }
    }

    // MARK: - Auth

    func checkSetup() async throws -> SetupRequired {
        try await request(method: "GET", path: "/auth/setup")
    }

    func registerFirst(name: String, email: String, password: String) async throws -> SuccessLogin {
        try await request(
            method: "POST",
            path: "/auth/register-first",
            body: RegisterFirstRequest(name: name, email: email, password: password)
        )
    }

    func login(email: String, password: String) async throws -> LoginResponse {
        try await request(
            method: "POST",
            path: "/auth/login",
            body: LoginRequest(email: email, password: password)
        )
    }

    func verifyTotp(code: String, pendingToken: String) async throws -> SuccessLogin {
        try await request(
            method: "POST",
            path: "/auth/mfa/totp/verify",
            body: VerifyTotpRequest(code: code),
            token: pendingToken
        )
    }

    func getMe(token: String) async throws -> UserInfo {
        try await request(method: "GET", path: "/auth/me", token: token)
    }

    // MARK: - Dashboard

    func getDashboard(token: String) async throws -> DashboardPayload {
        try await request(method: "GET", path: "/devices/dashboard", token: token)
    }

    func getDevice(token: String, externalId: String, range: String? = nil) async throws -> DeviceCard {
        var queryItems: [URLQueryItem]? = nil
        if let range {
            queryItems = [URLQueryItem(name: "range", value: range)]
        }
        return try await request(
            method: "GET",
            path: "/devices/dashboard/\(externalId)",
            token: token,
            queryItems: queryItems
        )
    }
}

// Helper for decoding error responses
private struct EmptyCodable: Codable {}
