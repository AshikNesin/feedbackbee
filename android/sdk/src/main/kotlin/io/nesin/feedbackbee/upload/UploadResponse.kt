package io.nesin.feedbackbee.upload

import org.json.JSONObject

/**
 * The server answers in an envelope: `{"success":true,"data":{"id","state","issueUrl"}}`
 * or `{"success":false,"error":{"code","message"}}` (docs/CONTRACT.md).
 */
internal fun parseUploadResponse(code: Int, body: String): UploadOutcome = when (code) {
    201 -> UploadOutcome.Accepted(jsonField(body, "data", "issueUrl"))
    202 -> UploadOutcome.Accepted(null)
    429 -> UploadOutcome.Rejected("Too many submissions. Please try again in a little while.")
    400, 404, 413, 415 ->
        UploadOutcome.Rejected(jsonField(body, "error", "message") ?: "The server rejected this feedback.")
    in 300..399 -> UploadOutcome.Rejected("The endpoint redirected (HTTP $code). Use the final URL, including https.")
    else -> UploadOutcome.Rejected("Server error (HTTP $code). Please try again later.")
}

private fun jsonField(body: String, objectName: String, name: String): String? = try {
    JSONObject(body).optJSONObject(objectName)?.optString(name)?.takeIf { it.isNotBlank() }
} catch (_: org.json.JSONException) {
    null
}
