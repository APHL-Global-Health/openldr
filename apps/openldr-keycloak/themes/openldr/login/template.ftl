<#macro registrationLayout bodyClass="" displayInfo=false displayMessage=true displayRequiredFields=false>
<!DOCTYPE html>
<html class="${properties.kcHtmlClass!}"<#if realm.internationalizationEnabled> lang="${locale.currentLanguageTag}"</#if>>

<head>
    <meta charset="utf-8">
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta name="robots" content="noindex, nofollow">
    <meta name="viewport" content="width=device-width, initial-scale=1">

    <#if properties.meta?has_content>
        <#list properties.meta?split(' ') as meta>
            <meta name="${meta?split('==')[0]}" content="${meta?split('==')[1]}"/>
        </#list>
    </#if>

    <title>${msg("loginTitle",(realm.displayName!''))}</title>
    
    <link rel="icon" href="${url.resourcesPath}/img/favicon.ico" />
    
    <#if properties.stylesCommon?has_content>
        <#list properties.stylesCommon?split(' ') as style>
            <link href="${url.resourcesCommonPath}/${style}" rel="stylesheet" />
        </#list>
    </#if>
    
    <#if properties.styles?has_content>
        <#list properties.styles?split(' ') as style>
            <link href="${url.resourcesPath}/${style}" rel="stylesheet" />
        </#list>
    </#if>
    
    <#if properties.scripts?has_content>
        <#list properties.scripts?split(' ') as script>
            <script src="${url.resourcesPath}/${script}" type="text/javascript"></script>
        </#list>
    </#if>
    
    <#if scripts??>
        <#list scripts as script>
            <script src="${script}" type="text/javascript"></script>
        </#list>
    </#if>
</head>

<body class="kc-body">
    <div id="kc-container" class="kc-container">
        
        <#-- Left Panel: Squares Background (Desktop only) -->
        <div id="kc-left-panel">
            <div id="kc-squares-container">
            </div>
            <div id="kc-squares-title">OPENLDR</div>
        </div>
        
        <#-- Right Panel: Form -->
        <div id="kc-right-panel">
            <div id="kc-title">OPENLDR</div>   
            <div class="${properties.kcFormCardClass!} card-pf">      

                  

                <div id="kc-content" class="kc-content">
                    <div id="kc-content-wrapper" class="kc-content-wrapper">

                        <#-- App-initiated actions -->
                        <#if displayMessage && message?has_content && (message.type != 'warning' || !isAppInitiatedAction??)>
                            <div class="alert alert-${message.type}">
                                <#if message.type = 'success'><span>✓</span></#if>
                                <#if message.type = 'warning'><span>⚠</span></#if>
                                <#if message.type = 'error'><span>✕</span></#if>
                                <#if message.type = 'info'><span>ℹ</span></#if>
                                <span class="kc-feedback-text">${kcSanitize(message.summary)?no_esc}</span>
                            </div>
                        </#if>

                        <#-- Title -->
                        <#if !(auth?has_content && auth.showUsername() && !auth.showResetCredentials())>
                            <#-- <h1 id="kc-page-title"><#nested "header"></h1> -->
                        </#if>

                        <#-- Form -->
                        <#nested "form">

                        <#-- Info -->
                        <#if displayInfo>
                            <div id="kc-info" class="${properties.kcSignUpClass!}">
                                <div id="kc-info-wrapper" class="${properties.kcInfoAreaWrapperClass!}">
                                    <#nested "info">
                                </div>
                            </div>
                        </#if>

                        <#-- Social Providers -->
                        <#nested "socialProviders">

                    </div>
                </div>

            </div>
        </div>
    </div>
</body>
</html>
</#macro>
