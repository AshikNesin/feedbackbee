package io.nesin.feedbackbarn.upload

import org.json.JSONObject

internal fun parseUploadResponse(code: Int, body: String): UploadOutcome = when (code) {
    201 -> UploadOutcome.Accepted(jsonField(body, "issueUrl"))
    202 -> UploadOutcome.Accepted(null)
    429 -> UploadOutcome.Rejected("Too many submissions. Please try again in a little while.")
    400 -> UploadOutcome.Rejected(jsonField(body, "error") ?: "The server rejected this feedback.")
    in 300..399 -> UploadOutcome.Rejected("The endpoint redirected (HTTP $code). Use the final URL, including https.")
    else -> UploadOutcome.Rejected("Server error (HTTP $code). Please try again later.")
}

private fun jsonField(body: String, name: String): String? = try {
    JSONObject(body).optString(name).takeIf { it.isNotBlank() }
} catch (_: org.json.JSONException) {
    null
}
