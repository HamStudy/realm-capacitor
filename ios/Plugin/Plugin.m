#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

CAP_PLUGIN(RealmAdapter, "RealmAdapter",
           CAP_PLUGIN_METHOD(command, CAPPluginReturnPromise);
)
