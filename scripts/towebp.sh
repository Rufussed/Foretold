#!/usr/bin/env bash
# Batch-convert images to WebP, optionally downscaling.
#
#   scripts/towebp.sh [-s SIZE|-w WIDTH|-x WxH] [-q QUALITY] [-o OUTDIR] [-n] FILE|DIR...
#
#   -s SIZE     max long-edge in px; only shrinks, never upscales (default: none)
#   -w WIDTH    exact width in px, height follows aspect ratio
#   -x WxH      exact dimensions, ignoring aspect ratio (squashes/stretches)
#   -q QUALITY  1-100 (default: 82; use 90+ for normal maps)
#   -o OUTDIR   write here instead of alongside the source
#   -n          dry run: print what would happen, convert nothing
set -euo pipefail

size=; width=; exact=; quality=82; outdir=; dryrun=

while getopts ':s:w:x:q:o:nh' opt; do
  case $opt in
    s) size=$OPTARG ;;
    w) width=$OPTARG ;;
    x) exact=$OPTARG ;;
    q) quality=$OPTARG ;;
    o) outdir=$OPTARG ;;
    n) dryrun=1 ;;
    h) sed -n '2,10p' "$0" | sed 's/^# \?//'; exit 0 ;;
    *) echo "unknown option: -$OPTARG" >&2; exit 2 ;;
  esac
done
n=0
for v in "$size" "$width" "$exact"; do [ -n "$v" ] && n=$((n + 1)); done
[ "$n" -gt 1 ] && { echo "-s, -w and -x are mutually exclusive" >&2; exit 2; }
shift $((OPTIND - 1))
[ $# -gt 0 ] || { echo "no inputs; -h for usage" >&2; exit 2; }

command -v magick >/dev/null || { echo "ImageMagick (magick) not found" >&2; exit 1; }
[ -n "$outdir" ] && [ -z "$dryrun" ] && mkdir -p "$outdir"

# Collect inputs: files as given, directories searched one level deep.
files=(); roots=()
for arg in "$@"; do
  if [ -d "$arg" ]; then
    while IFS= read -r -d '' f; do files+=("$f"); roots+=("${arg%/}"); done \
      < <(find "$arg" -type f \
            \( -iname '*.png' -o -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.tga' \) -print0)
  elif [ -f "$arg" ]; then
    files+=("$arg"); roots+=("")
  else
    echo "skipping (not found): $arg" >&2
  fi
done
[ ${#files[@]} -gt 0 ] || { echo "no images found" >&2; exit 1; }

before=0; after=0
for i in "${!files[@]}"; do
  src="${files[$i]}"
  if [ -n "$outdir" ]; then
    root="${roots[$i]}"
    rel="${src#"${root:+$root/}"}"                 # path relative to the dir given
    [ -n "$root" ] || rel="$(basename "$src")"
    dest="$outdir/${rel%.*}.webp"
    mkdir -p "$(dirname "$dest")"
  else
    dest="$(dirname "$src")/$(basename "${src%.*}").webp"
  fi
  resize=()
  [ -n "$size" ]  && resize=(-resize "${size}x${size}>")
  [ -n "$width" ] && resize=(-resize "${width}x")
  [ -n "$exact" ] && resize=(-resize "${exact}!")

  if [ -n "$dryrun" ]; then
    echo "would write: $dest"
    continue
  fi

  magick "$src" "${resize[@]}" -quality "$quality" -strip "$dest"

  s=$(stat -c%s "$src"); d=$(stat -c%s "$dest")
  before=$((before + s)); after=$((after + d))
  printf '%s\n  %s -> %s  (%d%%)\n' \
    "$dest" \
    "$(numfmt --to=iec "$s")" "$(numfmt --to=iec "$d")" \
    $((d * 100 / s))
done

[ -n "$dryrun" ] || printf '\n%d file(s): %s -> %s\n' \
  "${#files[@]}" "$(numfmt --to=iec "$before")" "$(numfmt --to=iec "$after")"
