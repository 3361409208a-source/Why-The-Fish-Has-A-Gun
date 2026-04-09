from PIL import Image
import os
import numpy as np


def remove_black_and_white(
    input_path, output_path=None, threshold=30, edge_smooth=True
):
    img = Image.open(input_path)

    if img.mode != "RGBA":
        img = img.convert("RGBA")

    img = img.convert("RGB")
    width, height = img.size
    pixels = np.array(img)

    bg_colors = []
    corners = [pixels[0, 0], pixels[0, -1], pixels[-1, 0], pixels[-1, -1]]

    for corner in corners:
        if not any(np.all(corner == c) for c in bg_colors):
            bg_colors.append(corner)

    mask = np.zeros((height, width), dtype=bool)

    for bg in bg_colors:
        dist = np.sqrt(np.sum((pixels - bg) ** 2, axis=2))
        mask |= dist < threshold

    if edge_smooth:
        from scipy import ndimage

        kernel = np.ones((3, 3)) / 9
        mask = ndimage.convolve(mask.astype(float), kernel, mode="constant") > 0.3

    result = Image.new("RGBA", (width, height))
    original = img.convert("RGBA")

    for y in range(height):
        for x in range(width):
            if mask[y, x]:
                result.putpixel((x, y), (0, 0, 0, 0))
            else:
                result.putpixel((x, y), original.getpixel((x, y)))

    if output_path is None:
        base, ext = os.path.splitext(input_path)
        output_path = f"{base}_transparent.png"

    result.save(output_path, "PNG")
    print(
        f"Processed: {os.path.basename(input_path)} -> {os.path.basename(output_path)}"
    )


def process_folder(folder_path, output_folder=None, threshold=30):
    if output_folder is None:
        output_folder = folder_path

    os.makedirs(output_folder, exist_ok=True)

    for filename in os.listdir(folder_path):
        if filename.lower().endswith((".png", ".jpg", ".jpeg", ".bmp")):
            input_path = os.path.join(folder_path, filename)

            base, ext = os.path.splitext(filename)
            output_filename = f"{base}_transparent.png"
            output_path = os.path.join(output_folder, output_filename)

            try:
                remove_black_and_white(input_path, output_path, threshold=threshold)
            except Exception as e:
                print(f"Error {filename}: {e}")


if __name__ == "__main__":
    import sys

    threshold = 30
    if len(sys.argv) > 1:
        input_path = sys.argv[1]
        if os.path.isdir(input_path):
            if len(sys.argv) > 2:
                threshold = int(sys.argv[2])
            process_folder(input_path, threshold=threshold)
        else:
            output_path = sys.argv[2] if len(sys.argv) > 2 else None
            if len(sys.argv) > 3:
                threshold = int(sys.argv[3])
            remove_black_and_white(input_path, output_path, threshold=threshold)
    else:
        folder = r"C:\Users\18229\Desktop\这鱼怎么带枪的！\public\assets"
        process_folder(folder, threshold=threshold)
