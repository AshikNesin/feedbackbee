#import <Foundation/Foundation.h>
#import <RNFeedbackBeeSpec/RNFeedbackBeeSpec.h>

#if __has_include(<FeedbackBeeReactNative/FeedbackBeeReactNative-Swift.h>)
#import <FeedbackBeeReactNative/FeedbackBeeReactNative-Swift.h>
#else
#import "FeedbackBeeReactNative-Swift.h"
#endif

/// TurboModule entry point. Every call forwards straight to the Swift SDK, which hops to the main
/// thread itself, so nothing here blocks the JS thread.
@interface FeedbackBeeModule : NSObject <NativeFeedbackBeeSpec>
@end

@implementation FeedbackBeeModule

RCT_EXPORT_MODULE(FeedbackBee)

// The Swift SDK hops to the main thread itself; creating this module never needs it.
+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

- (NSString *_Nullable)configure:(NSString *)projectId endpoint:(NSString *)endpoint shake:(BOOL)shake
{
  return [FeedbackBeeBridge configureWithProjectId:projectId endpoint:endpoint shake:shake];
}

- (void)open:(NSString *_Nullable)kind lockKind:(BOOL)lockKind text:(NSString *)text
{
  [FeedbackBeeBridge openWithKind:kind lockKind:lockKind text:text];
}

- (void)identify:(NSString *_Nullable)email name:(NSString *_Nullable)name reporterId:(NSString *_Nullable)reporterId
{
  [FeedbackBeeBridge identifyWithEmail:email name:name reporterId:reporterId];
}

- (void)setContext:(NSDictionary *)context
{
  [FeedbackBeeBridge setContext:context];
}

- (void)reset
{
  [FeedbackBeeBridge reset];
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeFeedbackBeeSpecJSI>(params);
}

@end
