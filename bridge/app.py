from flask import Flask, request, jsonify
from flask_cors import CORS
import base64
import io
import traceback

app = Flask(__name__)
CORS(app)

def print_label(png_base64: str, copies: int, label_size: str = "62"):
    try:
        from brother_ql.conversion import convert
        from brother_ql.backends.helpers import send
        from brother_ql.raster import BrotherQLRaster
        from PIL import Image

        png_bytes = base64.b64decode(png_base64)
        image = Image.open(io.BytesIO(png_bytes))
        image = image.convert("L")

        qlr = BrotherQLRaster("QL-800")
        qlr.exception_on_warning = True

        convert(
            qlr=qlr,
            images=[image] * copies,
            label=label_size,
            rotate="0",
            threshold=70.0,
            dither=False,
            compress=False,
            red=False,
            dpi_600=False,
            hq=True,
            cut=True,
        )

        # Identificatore fisso per Brother QL-800
        printer_id = "usb://0x04f9:0x209b"

        send(
            instructions=qlr.data,
            printer_identifier=printer_id,
            backend_identifier="pyusb",
            blocking=True,
        )

        return True, "OK"

    except Exception as e:
        traceback.print_exc()
        return False, str(e)


@app.route("/print", methods=["POST"])
def handle_print():
    try:
        data = request.get_json()

        if not data:
            return jsonify({"success": False, "error": "Nessun dato ricevuto"}), 400

        png_base64 = data.get("png_base64")
        copies     = int(data.get("copies", 1))
        label_size = data.get("label_size", "62")

        if not png_base64:
            return jsonify({"success": False, "error": "Nessuna immagine"}), 400

        success, message = print_label(png_base64, copies, label_size)

        if success:
            return jsonify({"success": True})
        else:
            return jsonify({"success": False, "error": message}), 500

    except Exception as e:
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/status", methods=["GET"])
def status():
    return jsonify({"status": "running", "version": "2.0"})


if __name__ == "__main__":
    print("HACCPrint Bridge v2.0 - running on port 8013")
    print("Press Ctrl+C to stop")
    app.run(host="0.0.0.0", port=8013, debug=True)