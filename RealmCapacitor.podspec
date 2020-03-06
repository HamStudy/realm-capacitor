package = JSON.parse(File.read(File.expand_path('package.json', __dir__)))

  Pod::Spec.new do |s|
    s.name = 'RealmCapacitor'
    s.version                = package['version']
    s.summary                = package['description']
    s.license                = package['license']

    s.author                 = package['author']
    s.homepage               = package['homepage']
    s.source = { :git => 'https://github.com/HamStudy/realm-capacitor.git', :tag => s.version.to_s }
    s.source_files =
        'ios/Plugin/*.{swift,m,c,mm,cpp,h}',
        'ios/Plugin/Plugin-Bridging-Header.h',
        'ios/realmjs/*.{swift,m,c,mm,cpp,hpp}',
        'realm-js/src/*.cpp',
        'realm-js/src/jsc/*.cpp',
        'realm-js/src/ios/*.mm',
        'realm-js/src/object-store/src/*.cpp',
        'realm-js/src/object-store/src/sync/*.cpp',
        'realm-js/src/object-store/src/sync/impl/*.cpp',
        'realm-js/src/object-store/src/sync/impl/apple/*.cpp',
        'realm-js/src/object-store/src/impl/*.cpp',
        'realm-js/src/object-store/src/impl/apple/*.cpp',
        'realm-js/src/object-store/src/util/*.cpp',
        'realm-js/src/object-store/src/util/apple/*.cpp',
        'realm-js/vendor/*.cpp'
    s.ios.deployment_target  = '11.0'
    s.prepare_command        = '/usr/bin/env node ./realm-js/scripts/download-realm.js ios --sync'
    s.script_phase = { :name => 'Download Realm Core & Sync',
        :script => 'echo "Using Node.js $(/usr/local/bin/node --version)" && /usr/local/bin/node ${PODS_TARGET_SRCROOT}/realm-js/scripts/download-realm.js ios --sync',
        :execution_position => :before_compile }
    s.frameworks = ['JavaScriptCore']
    s.library                = 'c++', 'z'
    s.compiler_flags         = '-DREALM_HAVE_CONFIG -DREALM_ENABLE_SYNC'

    s.pod_target_xcconfig    = { # Ensures ccache is used if installed on the users machine
                               # Setting up clang
                               'CLANG_CXX_LANGUAGE_STANDARD' => 'c++14',
                               'CLANG_CXX_LIBRARY' => 'libc++',
                               # Disabling warnings that object store, core and sync has a lot of
                               'CLANG_WARN_OBJC_IMPLICIT_RETAIN_SELF' => 'NO',
                               'CLANG_WARN_DOCUMENTATION_COMMENTS' => 'NO',
                               # Setting the current project version and versioning system to get a symbol for analytics
                               'CURRENT_PROJECT_VERSION' => s.version,
                               'VERSIONING_SYSTEM' => 'apple-generic',
                               # Header search paths are prefixes to the path specified in #include macros
                               'HEADER_SEARCH_PATHS' => [
                                 '"$(PODS_TARGET_SRCROOT)/realm-js/src/"',
                                 '"$(PODS_TARGET_SRCROOT)/realm-js/src/jsc/"',
                                 '"$(PODS_TARGET_SRCROOT)/realm-js/src/object-store/src/"',
                                 '"$(PODS_TARGET_SRCROOT)/realm-js/src/object-store/external/json/"',
                                 '"$(PODS_TARGET_SRCROOT)/realm-js/vendor/"',
                                 '"$(PODS_TARGET_SRCROOT)/realm-js/vendor/realm-ios/include/"',
                               ].join(' ')
                             }

    s.ios.vendored_libraries = 'realm-js/vendor/realm-ios/librealm-ios.a', 'realm-js/vendor/realm-ios/librealm-parser-ios.a'
    s.dependency 'Capacitor'
    s.dependency 'Realm'
  end