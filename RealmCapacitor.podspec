
  Pod::Spec.new do |s|
    s.name = 'RealmCapacitor'
    s.version = '0.0.1'
    s.summary = 'Realm adapter for Capacitor'
    s.license = 'MIT'
    s.homepage = 'https://github.com/HamStudy/realm-capacitor.git'
    s.author = 'Richard Bateman <richard@hamstudy.org>'
    s.source = { :git => 'https://github.com/HamStudy/realm-capacitor.git', :tag => s.version.to_s }
    s.source_files = 'ios/Plugin/**/*.{swift,h,m,c,cc,mm,cpp}'
    s.ios.deployment_target  = '11.0'
    s.dependency 'Capacitor'
  end