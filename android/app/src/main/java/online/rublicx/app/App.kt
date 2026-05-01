package online.rublicx.app

import android.app.Application

class App : Application() {
    override fun onCreate() {
        super.onCreate()
        instance = this
    }

    companion object {
        @Volatile var instance: App? = null
            private set
    }
}
