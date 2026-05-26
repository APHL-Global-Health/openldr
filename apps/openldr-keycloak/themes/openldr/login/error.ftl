<#import "template.ftl" as layout>
<@layout.registrationLayout displayMessage=false; section>
    <#if section = "header">
        <div id="kc-header-wrapper">
            <div class="kc-logo-text">OpenLDR</div>
            <#if realm.displayName??>
                <div class="kc-realm-name">${realm.displayName}</div>
            </#if>
        </div>
        ${kcSanitize(msg("errorTitle"))?no_esc}
    <#elseif section = "form">
        <div id="kc-error-message">
            <div class="alert alert-error">
                <span>✕</span>
                <p class="instruction">${kcSanitize(message.summary)?no_esc}</p>
                <#if skipLink??>
                <#else>
                    <#if client?? && client.baseUrl?has_content>
                        <p class="instruction" style="margin-top: 1rem;">
                            <a id="backToApplication" href="${client.baseUrl}">${kcSanitize(msg("backToApplication"))?no_esc}</a>
                        </p>
                    </#if>
                </#if>
            </div>
        </div>
    </#if>
</@layout.registrationLayout>
