import uk.mrxu.learning.trial.TrialPolicy;
public final class TrialPolicyTest {
    public static void main(String[] args){
        if(!TrialPolicy.allowed(TrialPolicy.ORIGIN+"/print.html?kind=growth"))throw new AssertionError("own origin");
        String[] denied={"http://junior-learning-trial-20261114.wenshu4119.workers.dev/","https://junior-learning-trial-20261114.wenshu4119.workers.dev.evil.invalid/","https://evil.invalid@junior-learning-trial-20261114.wenshu4119.workers.dev/","https://junior-learning-trial-20261114.wenshu4119.workers.dev:444/","javascript:alert(1)","file:///private","intent://private","not a uri"};
        for(String value:denied)if(TrialPolicy.allowed(value))throw new AssertionError("unexpected URL allowed");
        System.out.println("Android URL policy: 9 checks passed (JVM only, no device).");
    }
}
