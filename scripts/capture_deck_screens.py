import asyncio
from playwright.async_api import async_playwright
B="http://127.0.0.1:4173"; O="/home/claude/burn-clock/.deck/img/"
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(viewport={"width":1280,"height":900},device_scale_factor=2)
        await pg.goto(B+"/#home"); await pg.wait_for_timeout(2500)
        await pg.screenshot(path=O+"home_top.png",clip={"x":0,"y":0,"width":1280,"height":700})
        await pg.locator(".verdict-strip").screenshot(path=O+"strip.png")
        await pg.locator(".hour-share").screenshot(path=O+"hourshare.png")
        await pg.goto(B+"/?box=27.6,73.8,32.6,77.6&months=10,11&a=2021&b=2025#explorer"); await pg.get_by_test_id("verdict").wait_for(timeout=60000); await pg.wait_for_timeout(800)
        await pg.locator(".trend-verdict").screenshot(path=O+"verdict_punjab.png")
        await pg.locator(".decision-actions").screenshot(path=O+"actions_punjab.png")
        await pg.locator(".annual-chart").screenshot(path=O+"annual_punjab.png")
        await pg.add_style_tag(content=".skip-link{display:none!important}")
        await pg.locator(".calendar-card").screenshot(path=O+"calendar_punjab.png")
        from PIL import Image as _I
        _im=_I.open(O+"calendar_punjab.png");_im.crop((0,0,_im.size[0],int(_im.size[0]*0.52))).save(O+"calendar_punjab_top.png")
        await pg.goto(B+"/?box=-3.5,110,1,117&months=8,9&a=2019&b=2025#explorer"); await pg.get_by_test_id("verdict").wait_for(timeout=60000); await pg.wait_for_timeout(800)
        await pg.locator(".trend-verdict").screenshot(path=O+"verdict_kalimantan.png")
        await pg.goto(B+"/#cases"); await pg.wait_for_timeout(2000)
        await pg.locator(".case-grid").screenshot(path=O+"cases.png")
        await pg.goto(B+"/?box=27.6,73.8,32.6,77.6&months=10,11&a=2021&b=2025&role=journalist#claim"); await pg.get_by_test_id("verdict").wait_for(timeout=60000); await pg.wait_for_timeout(800)
        await pg.locator(".claim-card-preview").screenshot(path=O+"claimcard.png")
        await pg.goto(B+"/#receipt"); await pg.wait_for_timeout(2500)
        await pg.locator(".burning-panel").scroll_into_view_if_needed(); await pg.wait_for_timeout(3500)
        await pg.locator(".burning-panel").screenshot(path=O+"maps.png")
        await pg.goto(B+"/?district=Fazilka&dyear=2025&dbase=2021#act"); await pg.get_by_test_id("act-window").wait_for(timeout=60000); await pg.wait_for_timeout(800)
        await pg.locator("#act-field .act-two").screenshot(path=O+"act_field.png")
        await pg.locator(".say-grid").screenshot(path=O+"act_say.png")
        await b.close()
asyncio.run(main())
