from PIL import Image, ImageDraw
from pathlib import Path
import numpy as np

out = Path('source-images/power-symbols')
im = Image.open('tmp/power-icons/wizard-staff.png').convert('RGB')
values = np.array(im).mean(axis=2)
mask = Image.fromarray((np.clip((225-values)/210, 0, 1)*255).astype('uint8'))
mask = mask.crop(mask.getbbox())
w, h = mask.size
# Preserve spiral and foot; remove only a middle section of the straight shaft.
head = round(w*1.22)
target = round(w*2.9)
tail = target-head
medium = Image.new('L', (w,target))
medium.paste(mask.crop((0,0,w,head)), (0,0))
medium.paste(mask.crop((0,h-tail,w,h)), (0,head))

def save_icon(mask, size, filename):
    mask=mask.crop(mask.getbbox())
    scale=min((size[0]-48)/mask.width,(size[1]-48)/mask.height)
    mask=mask.resize((round(mask.width*scale),round(mask.height*scale)),Image.Resampling.LANCZOS)
    canvas=Image.new('RGBA',size,(255,255,255,0))
    white=Image.new('RGBA',mask.size,(255,255,255,255))
    white.putalpha(mask)
    canvas.alpha_composite(white,((size[0]-mask.width)//2,(size[1]-mask.height)//2))
    canvas.save(out/filename)
    print(filename,size,canvas.getchannel('A').getbbox())

save_icon(medium,(512,768),'wizard-v3.png')
hat=Image.open('/home/rlane/.codex/generated_images/01a1592c-eaf4-7bb2-84ba-a0085998ed69/exec-f4aac275-f409-4861-ab62-2333e5ac413d.png').convert('RGBA')
# Remove generation's nearly transparent edge dust and ensure solid white body.
hatmask=hat.getchannel('A').point(lambda value:255 if value>=128 else 0)
hatmask=hatmask.crop(hatmask.getbbox()).resize((464,464),Image.Resampling.LANCZOS)
save_icon(hatmask,(512,512),'fool-v3.png')
sheet=Image.new('RGB',(800,750),'#202937')
d=ImageDraw.Draw(sheet)
for i,(name,label) in enumerate([('fool-v3.png','Fool'),('wizard-v3.png','Wizard')]):
    icon=Image.open(out/name)
    large=icon.copy();large.thumbnail((340,540),Image.Resampling.LANCZOS)
    sheet.paste(large,(i*400+(400-large.width)//2,70+(540-large.height)//2),large)
    d.text((i*400+175,25),label,fill='white')
    for j,size in enumerate([24,40,64]):
        small=icon.copy();small.thumbnail((size,size if i==0 else round(size*1.5)),Image.Resampling.LANCZOS)
        sheet.paste(small,(i*400+90+j*90,635),small)
sheet.save(out/'preview-v3.png')
