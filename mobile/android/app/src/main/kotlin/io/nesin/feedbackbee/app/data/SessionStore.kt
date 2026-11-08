package io.nesin.feedbackbee.app.data

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import java.io.File
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * Where the app keeps who is signed in. Host, email and the last project are
 * plain preferences; the session token is AES-GCM encrypted with a key that
 * never leaves the Android Keystore (same scheme as OTP Bee's SecretStore).
 * Small and synchronous on purpose: read once at launch, before first frame.
 */
class SessionStore(context: Context, private val cipher: TokenCipher = KeystoreCipher) {
    private val prefs = context.getSharedPreferences("feedbackbee", Context.MODE_PRIVATE)
    private val tokenFile = File(context.noBackupFilesDir, "session.token")

    fun load(): Session? {
        val host = prefs.getString(KEY_HOST, null) ?: return null
        val email = prefs.getString(KEY_EMAIL, null) ?: return null
        val token = readToken() ?: return null
        return Session(host, email, token)
    }

    fun save(session: Session) {
        writeToken(session.token)
        prefs.edit().putString(KEY_HOST, session.host).putString(KEY_EMAIL, session.email).apply()
    }

    /** Sign out: forget the token. Host and email stay to prefill the sign-in form. */
    fun clear() {
        tokenFile.delete()
        prefs.edit().remove(KEY_LAST_PROJECT).apply()
    }

    val lastHost: String? get() = prefs.getString(KEY_HOST, null)
    val lastEmail: String? get() = prefs.getString(KEY_EMAIL, null)

    var lastProjectId: String?
        get() = prefs.getString(KEY_LAST_PROJECT, null)
        set(value) = prefs.edit().putString(KEY_LAST_PROJECT, value).apply()

    private fun writeToken(token: String) = tokenFile.writeBytes(cipher.encrypt(token.toByteArray(Charsets.UTF_8)))

    private fun readToken(): String? {
        if (!tokenFile.exists()) return null
        return runCatching { String(cipher.decrypt(tokenFile.readBytes()), Charsets.UTF_8) }.getOrNull()
    }

    private companion object {
        const val KEY_HOST = "host"
        const val KEY_EMAIL = "email"
        const val KEY_LAST_PROJECT = "last_project"
    }
}

/** How the token is sealed at rest. Tests swap in a plain one (Robolectric has no Keystore). */
interface TokenCipher {
    fun encrypt(plain: ByteArray): ByteArray
    fun decrypt(sealed: ByteArray): ByteArray
}

/** AES-256-GCM with a key that never leaves the Android Keystore; output is iv || ciphertext. */
object KeystoreCipher : TokenCipher {
    private const val KEY_ALIAS = "feedbackbee_session"
    private const val TRANSFORM = "AES/GCM/NoPadding"
    private const val IV_LEN = 12
    private const val TAG_BITS = 128

    override fun encrypt(plain: ByteArray): ByteArray {
        val cipher = Cipher.getInstance(TRANSFORM)
        cipher.init(Cipher.ENCRYPT_MODE, masterKey())
        return cipher.iv + cipher.doFinal(plain)
    }

    override fun decrypt(sealed: ByteArray): ByteArray {
        require(sealed.size > IV_LEN) { "sealed token too short" }
        val cipher = Cipher.getInstance(TRANSFORM)
        cipher.init(Cipher.DECRYPT_MODE, masterKey(), GCMParameterSpec(TAG_BITS, sealed, 0, IV_LEN))
        return cipher.doFinal(sealed, IV_LEN, sealed.size - IV_LEN)
    }

    private fun masterKey(): SecretKey {
        val keyStore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (keyStore.getKey(KEY_ALIAS, null) as? SecretKey)?.let { return it }
        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
        generator.init(
            KeyGenParameterSpec.Builder(KEY_ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build(),
        )
        return generator.generateKey()
    }
}
