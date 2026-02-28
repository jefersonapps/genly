const { withAndroidManifest } = require("@expo/config-plugins");

/**
 * Expo Config Plugin to inject activity-aliases into AndroidManifest.xml
 * to support multiple native share targets (Instagram style).
 */
module.exports = function withShareTargets(config) {
  return withAndroidManifest(config, (config) => {
    const application = config.modResults.manifest.application[0];
    
    if (!application["activity-alias"]) {
      application["activity-alias"] = [];
    }

    // Define our custom targets
    const aliases = [
      {
        name: ".CreateNoteActivity",
        label: "Criar Nota",
        mimeType: "image/*|text/plain|application/pdf"
      },
      {
        name: ".CreatePdfActivity",
        label: "Criar PDF",
        mimeType: "application/pdf|image/*"
      },
      {
        name: ".ScannerActivity",
        label: "Scanner",
        mimeType: "image/*"
      },
      {
        name: ".OcrActivity",
        label: "Extrair Texto",
        mimeType: "image/*"
      },
      {
        name: ".ConvertPdfActivity",
        label: "Converter PDF",
        mimeType: "application/pdf"
      },
      {
        name: ".QrReaderActivity",
        label: "Ler QR Code",
        mimeType: "image/*"
      },
      {
        name: ".ImportBackupActivity",
        label: "Importar Backup",
        mimeType: "application/zip|application/json"
      },
      {
        name: ".EditPdfActivity",
        label: "Editar PDF",
        mimeType: "application/pdf"
      }
    ];

    aliases.forEach(alias => {
        // Remove existing alias with the same name to prevent duplicates
        application["activity-alias"] = application["activity-alias"].filter(
            a => a.$["android:name"] !== alias.name
        );

        const intentFilters = [];
        const mimes = alias.mimeType.split("|");
        
        mimes.forEach(mime => {
            // Support single file sharing (SEND)
            intentFilters.push({
                action: [{ $: { "android:name": "android.intent.action.SEND" } }],
                category: [{ $: { "android:name": "android.intent.category.DEFAULT" } }],
                data: [{ $: { "android:mimeType": mime } }]
            });
            
            // Support multiple file sharing (SEND_MULTIPLE), except for OCR which handles one
            if (alias.name !== ".OcrActivity") {
                intentFilters.push({
                    action: [{ $: { "android:name": "android.intent.action.SEND_MULTIPLE" } }],
                    category: [{ $: { "android:name": "android.intent.category.DEFAULT" } }],
                    data: [{ $: { "android:mimeType": mime } }]
                });
            }
        });

        // Add the alias
        application["activity-alias"].push({
            $: {
                "android:name": alias.name,
                "android:targetActivity": ".MainActivity",
                "android:label": alias.label,
                "android:exported": "true",
                "android:icon": "@mipmap/ic_launcher"
            },
            "intent-filter": intentFilters
        });
    });

    return config;
  });
};
