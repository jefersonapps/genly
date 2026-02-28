import os
import re
import base64

fonts_dir = "src/lib/katex/fonts"
css_file = "src/lib/katex/katex.min.css"
output_file = "src/lib/katex/katex-fonts.ts"

with open(css_file, "r", encoding="utf-8") as f:
    css = f.read()

font_faces = re.findall(r"@font-face\s*\{[^}]+\}", css)

result = "// Auto-generated\n\nexport const KatexFontFaces = `\n"

for font_face in font_faces:
    family_match = re.search(r"font-family:([^;}]+)", font_face)
    if not family_match: continue
    family = family_match.group(1).strip().replace("'", "").replace('"', '')

    weight_match = re.search(r"font-weight:([^;}]+)", font_face)
    weight = weight_match.group(1).strip() if weight_match else "normal"

    style_match = re.search(r"font-style:([^;}]+)", font_face)
    style = style_match.group(1).strip() if style_match else "normal"

    ttf_match = re.search(r"url\(([^)]+\.ttf)\)", font_face)
    if not ttf_match: continue
    ttf_url = ttf_match.group(1).replace("'", "").replace('"', '')

    ttf_path = os.path.join(fonts_dir, ttf_url.replace("fonts/", ""))
    if os.path.exists(ttf_path):
        with open(ttf_path, "rb") as f:
            b64 = base64.b64encode(f.read()).decode("utf-8")
        result += f"  @font-face {{ font-family: '{family}'; src: url('data:font/ttf;base64,{b64}') format('truetype'); font-weight: {weight}; font-style: {style}; }}\n"

result += "`;\n"

with open(output_file, "w", encoding="utf-8") as f:
    f.write(result)

print("Done")
