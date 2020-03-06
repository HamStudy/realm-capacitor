//
//  PluginHelper.m
//  Plugin
//
//  Created by Richard Bateman on 3/4/20.
//  Copyright © 2020 Max Lynch. All rights reserved.
//

#import <Foundation/Foundation.h>
//#import <JavaScriptCore/JavaScriptCore.h>

#import "PluginHelper.h"

#import "jsc/jsc_init.hpp"

#import "impl/realm_coordinator.hpp"
#import "shared_realm.hpp"

#include "rpc.hpp"

using namespace realm;
using nlohmann::json;

@implementation RealmAdapterHelper {
    std::unique_ptr<rpc::RPCServer> _rpcServer;
//    JSVirtualMachine* jsVM;
//    JSContext* jsCtx;
}

//void _initializeOnJSThread(JSContextRef jsCtx) {
//    // Make sure the previous JS thread is completely finished before continuing.
//    static __weak NSThread *s_currentJSThread;
//    while (s_currentJSThread && !s_currentJSThread.finished) {
//        [NSThread sleepForTimeInterval:0.1];
//    }
//    s_currentJSThread = [NSThread currentThread];
//
//    // Close all cached Realms from the previous JS thread.
//    realm::_impl::RealmCoordinator::clear_all_caches();
//
//    RJSInitializeInContext(jsCtx);
//}

- (NSString*)withPath:(NSString*)path executeCommand:(NSString*)cmd {
    NSData *responseData;
    rpc::RPCServer *rpcServer = self ? self->_rpcServer.get() : nullptr;
    
    if (rpcServer) {
        try {
            json args = json::parse(cmd.UTF8String);
            std::string responseText = rpcServer->perform_request(path.UTF8String, std::move(args)).dump();

            responseData = [NSData dataWithBytes:responseText.c_str() length:responseText.length()];
        } catch (json::parse_error& ex) {
            return [NSString stringWithFormat:@"Error: %@", [NSString stringWithUTF8String:ex.what()]];
        }
    } else {
        // we have been deallocated
        responseData = [NSData dataWithBytes:"" length:1];
    }
    
    return [[NSString alloc] initWithData:responseData encoding:NSUTF8StringEncoding];
}

- (void)startJSRPC {
//    self->jsVM = [JSVirtualMachine new];
//    self->jsCtx = [[JSContext alloc] initWithVirtualMachine:self->jsVM];
//
//    _initializeOnJSThread([self->jsCtx JSGlobalContextRef]);
//
    self->_rpcServer = std::make_unique<rpc::RPCServer>();
}

- (void)dealloc {
    self->_rpcServer.reset();
}

@end
