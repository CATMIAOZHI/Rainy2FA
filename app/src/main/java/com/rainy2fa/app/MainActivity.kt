package com.rainy2fa.app

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.provider.MediaStore
import android.webkit.JavascriptInterface
import android.webkit.PermissionRequest
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.compose.setContent
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.fragment.app.FragmentActivity
import com.rainy2fa.app.ui.theme.Rainy2FATheme
import java.io.File
import java.io.FileOutputStream

class MainActivity : FragmentActivity() {

    private var pendingPermissionRequest: PermissionRequest? = null
    private var fileChooserCallback: ValueCallback<Array<Uri>>? = null
    private var pendingExportData: String? = null
    private var cameraImageUri: Uri? = null
    private var webViewRef: WebView? = null // 保存浏览器实例用于发送取消指令喵！

    // 我们自己管控的小巧 requestCode，绝不溢出！
    private companion object {
        const val REQ_CAMERA_PERMISSION = 100
        const val REQ_CAMERA_CAPTURE = 101
        const val REQ_FILE_PICKER = 102
        const val REQ_FILE_CREATE = 103
    }
    
    private val isAuthenticated = mutableStateOf(false)

    // JS 桥接：导出备份
    inner class WebAppInterface(private val mContext: Context) {
        @JavascriptInterface
        fun exportBackup(jsonData: String) {
            pendingExportData = jsonData
            runOnUiThread {
                try {
                    val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
                        addCategory(Intent.CATEGORY_OPENABLE)
                        type = "application/json"
                        putExtra(Intent.EXTRA_TITLE, "Yuqing2FA_Backup_${System.currentTimeMillis()}.json")
                    }
                    startActivityForResult(intent, REQ_FILE_CREATE)
                } catch (e: Exception) {
                    Toast.makeText(mContext, "导出失败: ${e.message}", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        authenticateUser()

        setContent {
            Rainy2FATheme {
                if (!isAuthenticated.value) {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .background(Color(0xFFFFF0F5))
                    ) {
                        // 轻触重试生物识别喵~
                        val interactionSource = remember { androidx.compose.foundation.interaction.MutableInteractionSource() }
                        androidx.compose.material3.Text(
                            text = "🔐 轻触屏幕重新验证喵~",
                            modifier = Modifier
                                .fillMaxSize()
                                .clickable(
                                    indication = null,
                                    interactionSource = interactionSource
                                ) { authenticateUser() },
                            style = androidx.compose.material3.MaterialTheme.typography.titleMedium,
                            color = Color(0xFFCC8899)
                        )
                    }
                } else {
                    MainWebView(
                        modifier = Modifier
                            .fillMaxSize()
                            .systemBarsPadding(),
                        onWebPermissionRequested = { request ->
                            handleWebPermissionRequest(request)
                        },
                        onFileChooserRequested = { callback, isCameraCapture ->
                            // 如果之前有卡死的 callback，先给它个 null 痛快！
                            fileChooserCallback?.onReceiveValue(null)
                            fileChooserCallback = callback

                            if (isCameraCapture) {
                                launchCameraIntent()
                            } else {
                                launchFilePickerIntent()
                            }
                        },
                        onWebViewCreated = { webViewRef = it },
                        jsInterface = WebAppInterface(this)
                    )
                }
            }
        }
    }

    private fun launchCameraIntent() {
        try {
            val qrDir = File(filesDir, "qr_scans")
            if (!qrDir.exists()) qrDir.mkdirs()
            val photoFile = File(qrDir, "qr_scan_${System.currentTimeMillis()}.jpg")
            cameraImageUri = FileProvider.getUriForFile(
                this,
                "${packageName}.fileprovider",
                photoFile
            )
            val intent = Intent(MediaStore.ACTION_IMAGE_CAPTURE).apply {
                putExtra(MediaStore.EXTRA_OUTPUT, cameraImageUri)
                addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
            }
            startActivityForResult(intent, REQ_CAMERA_CAPTURE)
        } catch (e: Exception) {
            Toast.makeText(this, "相机启动失败: ${e.message}", Toast.LENGTH_LONG).show()
            launchFilePickerIntent()
        }
    }

    private fun launchFilePickerIntent() {
        try {
            val intent = Intent(Intent.ACTION_GET_CONTENT).apply {
                addCategory(Intent.CATEGORY_OPENABLE)
                // 严格限制为 json 格式喵！
                type = "application/json"
            }
            startActivityForResult(intent, REQ_FILE_PICKER)
        } catch (e: Exception) {
            Toast.makeText(this, "文件管理器启动失败", Toast.LENGTH_SHORT).show()
            fileChooserCallback?.onReceiveValue(null)
            fileChooserCallback = null
        }
    }

    private fun authenticateUser() {
        val executor = ContextCompat.getMainExecutor(this)
        val biometricPrompt = BiometricPrompt(this, executor,
            object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                    super.onAuthenticationError(errorCode, errString)
                    // 非用户取消时自动重试喵；取消则等待主人手动重试
                    if (errorCode != BiometricPrompt.ERROR_CANCELED &&
                        errorCode != BiometricPrompt.ERROR_USER_CANCELED &&
                        errorCode != BiometricPrompt.ERROR_NEGATIVE_BUTTON) {
                        authenticateUser()
                    }
                }
                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                    super.onAuthenticationSucceeded(result)
                    Toast.makeText(applicationContext, "欢迎主人回来喵！雨晴一直都在等您哩💖", Toast.LENGTH_SHORT).show()
                    isAuthenticated.value = true
                }
                override fun onAuthenticationFailed() {
                    super.onAuthenticationFailed()
                    // 安静等待喵
                }
            })

        val promptInfo = BiometricPrompt.PromptInfo.Builder()
            .setTitle("喵呜？是主人吗喵？")
            .setSubtitle("快来按一下小肉垫，让雨晴开开门喵~")
            .setAllowedAuthenticators(
                BiometricManager.Authenticators.BIOMETRIC_STRONG or
                BiometricManager.Authenticators.DEVICE_CREDENTIAL
            )
            .build()
        biometricPrompt.authenticate(promptInfo)
    }

    private fun handleWebPermissionRequest(request: PermissionRequest) {
        val resources = request.resources
        if (resources.contains(PermissionRequest.RESOURCE_VIDEO_CAPTURE)) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
                == PackageManager.PERMISSION_GRANTED) {
                runOnUiThread { request.grant(arrayOf(PermissionRequest.RESOURCE_VIDEO_CAPTURE)) }
            } else {
                pendingPermissionRequest = request
                ActivityCompat.requestPermissions(
                    this,
                    arrayOf(Manifest.permission.CAMERA),
                    REQ_CAMERA_PERMISSION
                )
            }
        } else {
            request.deny()
        }
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == REQ_CAMERA_PERMISSION) {
            if (grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                pendingPermissionRequest?.grant(pendingPermissionRequest?.resources)
            } else {
                pendingPermissionRequest?.deny()
            }
            pendingPermissionRequest = null
        }
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        when (requestCode) {
            REQ_CAMERA_CAPTURE -> {
                if (resultCode == RESULT_OK && cameraImageUri != null) {
                    fileChooserCallback?.onReceiveValue(arrayOf(cameraImageUri!!))
                } else {
                    fileChooserCallback?.onReceiveValue(null)
                    // 主动通报网页：主人由于种种原因没有拍照喵！
                    webViewRef?.evaluateJavascript("if(window.cancelScanner)window.cancelScanner();", null)
                }
                fileChooserCallback = null
                cameraImageUri = null
            }
            REQ_FILE_PICKER -> {
                if (resultCode == RESULT_OK && data?.data != null) {
                    fileChooserCallback?.onReceiveValue(arrayOf(data.data!!))
                } else {
                    fileChooserCallback?.onReceiveValue(null)
                    webViewRef?.evaluateJavascript("if(window.cancelScanner)window.cancelScanner();", null)
                }
                fileChooserCallback = null
            }
            REQ_FILE_CREATE -> {
                if (resultCode == RESULT_OK && data?.data != null && pendingExportData != null) {
                    try {
                        contentResolver.openOutputStream(data.data!!)?.use { os ->
                            os.write(pendingExportData!!.toByteArray())
                            Toast.makeText(this, "备份成功保存喵！", Toast.LENGTH_LONG).show()
                        }
                    } catch (e: Exception) {
                        Toast.makeText(this, "保存失败: ${e.message}", Toast.LENGTH_SHORT).show()
                    }
                }
                pendingExportData = null
            }
        }
    }
}

@Composable
fun MainWebView(
    modifier: Modifier = Modifier,
    onWebPermissionRequested: (PermissionRequest) -> Unit,
    onFileChooserRequested: (ValueCallback<Array<Uri>>, Boolean) -> Unit,
    onWebViewCreated: (WebView) -> Unit,
    jsInterface: MainActivity.WebAppInterface
) {
    AndroidView(
        modifier = modifier.fillMaxSize(),
        factory = { context ->
            WebView(context).also { wv -> onWebViewCreated(wv) }.apply {
                settings.apply {
                    javaScriptEnabled = true
                    domStorageEnabled = true
                    databaseEnabled = true
                    allowFileAccess = true
                    allowContentAccess = true
                    mediaPlaybackRequiresUserGesture = false
                    mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
                }

                addJavascriptInterface(jsInterface, "AndroidBridge")
                webViewClient = WebViewClient()
                
                // 彻底干掉 WebView 系统级的滚动条和回弹光晕喵！
                isVerticalScrollBarEnabled = false
                isHorizontalScrollBarEnabled = false
                overScrollMode = android.view.View.OVER_SCROLL_NEVER

                webChromeClient = object : WebChromeClient() {
                    override fun onPermissionRequest(request: PermissionRequest) {
                        onWebPermissionRequested(request)
                    }

                    override fun onShowFileChooser(
                        webView: WebView?,
                        filePathCallback: ValueCallback<Array<Uri>>?,
                        fileChooserParams: FileChooserParams?
                    ): Boolean {
                        if (filePathCallback == null) return false
                        val isCameraCapture = fileChooserParams?.isCaptureEnabled == true
                        onFileChooserRequested(filePathCallback, isCameraCapture)
                        return true
                    }

                    override fun onJsAlert(
                        view: WebView?, url: String?, message: String?,
                        result: android.webkit.JsResult?
                    ): Boolean {
                        android.app.AlertDialog.Builder(context)
                            .setTitle("雨晴 2FA")
                            .setMessage(message)
                            .setPositiveButton("确定") { _, _ -> result?.confirm() }
                            .setCancelable(false)
                            .show()
                        return true
                    }

                    override fun onJsConfirm(
                        view: WebView?, url: String?, message: String?,
                        result: android.webkit.JsResult?
                    ): Boolean {
                        android.app.AlertDialog.Builder(context)
                            .setMessage(message)
                            .setPositiveButton("确定") { _, _ -> result?.confirm() }
                            .setNegativeButton("取消") { _, _ -> result?.cancel() }
                            .setCancelable(false)
                            .show()
                        return true
                    }
                }
                loadUrl("file:///android_asset/index.html")
            }
        }
    )
}
