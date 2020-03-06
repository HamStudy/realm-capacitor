import Foundation
import Capacitor

import JavaScriptCore

/**
 * Please read the Capacitor iOS Plugin Development Guide
 * here: https://capacitor.ionicframework.com/docs/plugins/ios
 */
@objc(RealmAdapter)
public class RealmAdapter: CAPPlugin {
    
    let helper = RealmAdapterHelper();
    
    public override init!(bridge: CAPBridge!, pluginId: String!, pluginName: String!) {
        super.init(bridge: bridge, pluginId: pluginId, pluginName: pluginName);
        
        helper.startJSRPC();
    }
    
    @objc public override func load() {
        // Hopefully called when things start up...

    }
    
    @objc func command(_ call: CAPPluginCall) {
        let name = call.getString("name") ?? "";
        let cmd = call.getString("cmd") ?? "";
        
        let result = helper.withPath(name, executeCommand: cmd);
        call.success([
            "result": result!
        ]);
    }
    
//    deinit {
//    }
}
