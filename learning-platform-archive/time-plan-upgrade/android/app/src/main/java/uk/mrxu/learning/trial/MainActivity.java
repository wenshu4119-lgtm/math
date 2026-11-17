package uk.mrxu.learning.trial;
import android.app.Activity;
import android.os.Bundle;
import android.content.Intent;
import android.content.ActivityNotFoundException;
import android.net.Uri;
import android.graphics.Color;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.ScrollView;
import android.widget.Toast;

/** Trial browser companion: credentials and learning data remain in the browser. */
public final class MainActivity extends Activity {
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        ScrollView scroll=new ScrollView(this);
        LinearLayout content=new LinearLayout(this);content.setOrientation(LinearLayout.VERTICAL);content.setPadding(32,64,32,32);content.setBackgroundColor(Color.rgb(244,248,252));
        scroll.addView(content);setContentView(scroll);
        text(content,"智学方舟",32);text(content,"初中数学与英语 · 独立试用",19);
        text(content,"筛查 → 针对性学习 → 复测成长\n\n线上自主学习，与线下教师辅导衔接。",21);
        Button open=new Button(this);open.setText("进入真实学习平台");open.setOnClickListener(v->openSite(false));content.addView(open);
        Button browser=new Button(this);browser.setText("在浏览器中打开 · PDF / 打印");browser.setOnClickListener(v->openSite(true));content.addView(browser);
        text(content,"使用管理员分配的账号。登录、保存和导出由真实网站处理，共用所选浏览器会话。应用不读取密码、Cookie 或学习记录。",16);
        text(content,"试用阶段仅使用别名和合成资料。图片上传、OCR、AI 与排课签到暂不可用。此版本需要联网和支持 HTTPS 的浏览器。",16);
        text(content,"PDF：在业务页面选择导出 PDF / 打印，核对预览后使用浏览器打印或保存入口。移动浏览器的实际打印能力依赖设备，尚未真机或物理打印验证。",16);
        text(content,"0.1.0-trial · 非商店发行\n不申请相机、存储、通讯录、定位权限。",14);
    }
    private void text(LinearLayout parent,String value,int size){TextView label=new TextView(this);label.setText(value);label.setTextColor(Color.rgb(24,46,65));label.setTextSize(size);label.setPadding(0,0,0,28);parent.addView(label);}
    private void openSite(boolean fullBrowser) {
        String target=TrialPolicy.ORIGIN+"/";
        if(!TrialPolicy.allowed(target))return;
        Intent intent=new Intent(Intent.ACTION_VIEW,Uri.parse(target));
        intent.addCategory(Intent.CATEGORY_BROWSABLE);
        if(!fullBrowser){Bundle extras=new Bundle();extras.putBinder("android.support.customtabs.extra.SESSION",null);intent.putExtras(extras);intent.putExtra("android.support.customtabs.extra.TOOLBAR_COLOR",Color.rgb(23,93,145));intent.putExtra("android.support.customtabs.extra.TITLE_VISIBILITY",1);}
        try{startActivity(intent);}catch(ActivityNotFoundException e){Toast.makeText(this,"未找到可用浏览器，请先安装或启用可信的 HTTPS 浏览器。",Toast.LENGTH_LONG).show();}
    }
}
