package uk.mrxu.learning.trial;
import java.net.URI;
public final class TrialPolicy {
    public static final String ORIGIN="https://junior-learning-trial-20261114.wenshu4119.workers.dev";
    private TrialPolicy() {}
    public static boolean allowed(String value) {
        try { URI uri=URI.create(value); return "https".equals(uri.getScheme()) && "junior-learning-trial-20261114.wenshu4119.workers.dev".equals(uri.getHost()) && uri.getRawUserInfo()==null && (uri.getPort()==-1 || uri.getPort()==443); }
        catch (IllegalArgumentException e) { return false; }
    }
}
