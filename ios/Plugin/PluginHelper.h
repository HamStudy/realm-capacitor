//
//  PluginHelper.h
//  Plugin
//
//  Created by Richard Bateman on 3/4/20.
//  Copyright © 2020 Max Lynch. All rights reserved.
//

#ifndef PluginHelper_h
#define PluginHelper_h

@interface RealmAdapterHelper : NSObject

- (void) startJSRPC;
- (NSString*)withPath:(NSString*)path executeCommand:(NSString*)cmd;

@end

#endif /* PluginHelper_h */
