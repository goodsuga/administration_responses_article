// ==UserScript==
// @name         New Userscript
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  try to take over the world!
// @author       You
// @match        https://vk.com/wall-*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=vk.com
// @grant        none
// ==/UserScript==

/*
Получить тело поста после waitFor миллисекунд
*/
function getBodyAfterWait(waitFor){
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve(document.getElementById("wk_content"));
        }, waitFor);
    });
}

/*
Дождаться загрузки тела поста и вернуть тело поста.
Фактически, пытается получить тело каждые 2 секунды.
*/
async function getBody(){
    console.log("Inside getBody");
    let body = await getBodyAfterWait(2000);
    console.log("Initial body obtained: ");
    console.log(body);
    while(body === null){
        console.log("Body is not available yet!");
        body = await getBodyAfterWait(2000);
        console.log("After wait body obtained: ");
        console.log(body);
    }
    return body;
}

/*
Проверяет есть ли после имени человека приписка "Автор"
*/
function didAuthorReply(reply){
    try {
        console.log("Checking for author replies in ", reply);
        let reply_author_info = reply.children[0].children[1].children[1].children;
        console.log("Author reply info = ", reply_author_info);
        if(reply_author_info.length <= 3){
            return false;
        }
        return reply_author_info[3].innerText === "Автор";
    } catch {
        return false;
    }
}

/*
Получить имя автора ответа на комментарий
*/
function getReplyAuthor(reply){
    return reply.children[0].children[1].children[1].children[0].innerText;
}

/*
Получить текст ответа на комментарий
*/
function getReplyText(reply){
    return reply.children[0].children[1].children[2].innerText;
}

/*
Нажать на все кнопки, раскрывающие ветки ответов
и раскрывающие длинные комментарии. Сделать это дважды, т.к.
иногда бывает так, что после прогрузки можно снова развернуть
ветки или комментарии.
*/
async function expand_comments(){
    // Развернуть комментарии
    let show_more_buttons = document.getElementsByClassName("replies_next_shown");
    for(let i = 0; i < show_more_buttons.length; i += 1){
        show_more_buttons[i].click();
    }

    // Развернуть дополнительные ответы
    let expand_buttons = document.getElementsByClassName("wall_reply_more");
    for(let i = 0; i < expand_buttons.length; i += 1){
        expand_buttons[i].click();
    }
    return (show_more_buttons.length == 0) && (expand_buttons.length == 0);
}

/*
Разворачиваем комментарии дважды, с ожиданием
*/
async function expand_and_wait_for_comments(waitFor){
    expand_comments();
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve(expand_comments());
        }, waitFor);
    });
}

// Парсим пост
async function startParse(){
    console.log("Begin parsing");
    let to_append = [];
    let post_body = await getBody();
    console.log("Successfully waited for body. Now body is\n", post_body);
    console.log("Expanding comments");

    await expand_and_wait_for_comments(2000);

    console.log("Getting wall replies: ");
    let wall_reply_segment = document.getElementsByClassName("wl_replies")[0];
    console.log(wall_reply_segment);
    console.log("Iterating over reply seg children: ");
    for(let i = 0; i < wall_reply_segment.children.length - 1; i += 1){
        let base_reply = wall_reply_segment.children[i];
        let next_block = wall_reply_segment.children[i+1];

        let base_block_class = base_reply.className;
        let next_block_class = next_block.className;

        // Check if the current post is a base post
        // and make sure the next block is the reply block to it.
        if (
            base_block_class.includes("reply_replieable")
            && next_block_class.includes("replies_wrap_deep")
        ) {
            // check if the author replied in the reply block
            console.log("This is a proper block!");
            let base_block_id = base_reply.getAttribute("id");
            let replies_segment_id = base_block_id.replaceAll("post-", "replies-");
            console.log("Base block id = ", base_block_id, " ; and replies segment id = ", replies_segment_id);
            let replies = document.getElementById(replies_segment_id);
            let authorReplied = false;
            for(let b = 0; b < replies.children.length; b += 1){
                console.log("Checking ", b);
                if(didAuthorReply(replies.children[b])){
                    // If the author replied here, change the flag and stop
                    authorReplied = true;
                    break;
                }
            }
            // if the author replied, save the branch
            if(authorReplied === true){
                let page_url = window.location.href;

                let base_authorName = base_reply.children[0].children[1].children[1].children[0].innerText;
                let base_replyText = base_reply.children[0].children[1].children[2].children[0].children[0].innerText;
                let pushed_obj = {};
                pushed_obj["author_name"] = base_authorName;
                pushed_obj["text"] = base_replyText;
                pushed_obj["dialogue_index"] = 0;
                pushed_obj["is_page_admin"] = false;
                pushed_obj["page_url"] = page_url;
                to_append.push(pushed_obj);
                for(let b = 0; b < replies.children.length; b += 1){
                    let authorName = getReplyAuthor(replies.children[b]);
                    let replyText = getReplyText(replies.children[b]);
                    pushed_obj = {};
                    pushed_obj["author_name"] = authorName;
                    pushed_obj["text"] = replyText;
                    pushed_obj["dialogue_index"] = b + 1;
                    pushed_obj["is_page_admin"] = didAuthorReply(replies.children[b]);
                    pushed_obj["page_url"] = page_url;
                    to_append.push(pushed_obj);
                }
                console.log(to_append);
            }

        }

        console.log("This block class = ", base_block_class, " ; and next block class = ", next_block_class);
        console.log("---------------");
    }
    return to_append;
}

async function parser_main(){
    console.log("Will begin parsing now");

    // Рекомендую просто свернуть этот блок ссылок
    let urls = [
        "https://vk.com/wall-152305577?day=15102023&w=wall-152305577_4590%2Fall",
        "https://vk.com/wall-152305577?day=15102023&w=wall-152305577_4569%2Fall",
        "https://vk.com/wall-152305577?day=15102023&w=wall-152305577_4538%2Fall",
        "https://vk.com/wall-152305577?day=15102023&w=wall-152305577_4527%2Fall",
        "https://vk.com/wall-152305577?day=15102023&w=wall-152305577_4522%2Fall",
        "https://vk.com/wall-152305577?day=15102023&w=wall-152305577_4518%2Fall",
        "https://vk.com/wall-152305577?day=15102023&w=wall-152305577_4517%2Fall",
        "https://vk.com/wall-171518584?day=15102023&w=wall-171518584_19148%2Fall",
        "https://vk.com/wall-171518584?day=15102023&w=wall-171518584_19143%2Fall",
        "https://vk.com/wall-171518584?day=15102023&w=wall-171518584_19111%2Fall",
        "https://vk.com/wall-171518584?day=15102023&w=wall-171518584_19099%2Fall",
        "https://vk.com/wall-171518584?day=15102023&w=wall-171518584_19090%2Fall",
        "https://vk.com/wall-171518584?day=15102023&w=wall-171518584_19086%2Fall",
        "https://vk.com/wall-171518584?day=15102023&w=wall-171518584_19065%2Fall",
        "https://vk.com/wall-171518584?day=15102023&w=wall-171518584_19052%2Fall",
        "https://vk.com/wall-171518584?day=15102023&w=wall-171518584_19028%2Fall",
        "https://vk.com/wall-171518584?day=15102023&w=wall-171518584_19025%2Fall",
        "https://vk.com/wall-171518584?day=15102023&w=wall-171518584_19020%2Fall",
        "https://vk.com/wall-171518584?day=15102023&w=wall-171518584_18993%2Fall",
        "https://vk.com/wall-171518584?day=15102023&w=wall-171518584_18989%2Fall",
        "https://vk.com/wall-171518584?day=15102023&w=wall-171518584_18961%2Fall",
        "https://vk.com/wall-171518584?day=15102023&w=wall-171518584_18955%2Fall",
        "https://vk.com/wall-171518584?day=15102023&w=wall-171518584_18946%2Fall",
        "https://vk.com/wall-171518584?day=15102023&w=wall-171518584_18935%2Fall",
        "https://vk.com/wall-171518584?day=15102023&w=wall-171518584_18920%2Fall",
        "https://vk.com/wall-171518584?day=15102023&w=wall-171518584_18897%2Fall",
        "https://vk.com/wall-171518584?day=15102023&w=wall-171518584_18890%2Fall",
        "https://vk.com/wall-171518584?day=15102023&w=wall-171518584_18862%2Fall",
        "https://vk.com/wall-171518584?day=15102023&offset=20&w=wall-171518584_18809%2Fall",
        "https://vk.com/wall-171518584?day=15102023&offset=20&w=wall-171518584_18806%2Fall",
        "https://vk.com/wall-171518584?day=15102023&offset=20&w=wall-171518584_18802%2Fall",
        "https://vk.com/wall-171518584?day=15102023&offset=20&w=wall-171518584_18784%2Fall",
        "https://vk.com/wall-171518584?day=15102023&offset=20&w=wall-171518584_18778%2Fall",
        "https://vk.com/wall-171518584?day=15102023&offset=20&w=wall-171518584_18730%2Fall",
        "https://vk.com/wall-171518584?day=15102023&offset=20&w=wall-171518584_18726%2Fall",
        "https://vk.com/wall-171518584?day=15102023&offset=20&w=wall-171518584_18725%2Fall",
        "https://vk.com/wall-184380088?day=30092023&w=wall-184380088_5107",
        "https://vk.com/wall-184380088?day=30092023&w=wall-184380088_5080%2Fall",
        "https://vk.com/wall-166892945?day=30092023&w=wall-166892945_6994%2Fall",
        "https://vk.com/wall-166892945?day=30092023&w=wall-166892945_6922%2Fall",
        "https://vk.com/wall-166892945?day=30092023&w=wall-166892945_6921%2Fall",
        "https://vk.com/wall-166892945?day=30092023&w=wall-166892945_6898%2Fall",
        "https://vk.com/wall-166892945?day=30092023&w=wall-166892945_6889%2Fall",
        "https://vk.com/wall-166892945?day=30092023&w=wall-166892945_6856%2Fall",
        "https://vk.com/wall-166892945?day=30092023&w=wall-166892945_6814%2Fall",
        "https://vk.com/wall-166892945?day=30092023&w=wall-166892945_6809%2Fall",
        "https://vk.com/wall-166892945?day=30092023&w=wall-166892945_6798%2Fall",
        "https://vk.com/wall-166892945?day=30092023&w=wall-166892945_6782%2Fall",
        "https://vk.com/wall-166892945?day=30092023&w=wall-166892945_6755%2Fall",
        "https://vk.com/wall-166892945?day=30092023&w=wall-166892945_6736%2Fall",
        "https://vk.com/wall-188772536?day=30092023&w=wall-188772536_4440%2Fall",
        "https://vk.com/wall-188772536?day=30092023&w=wall-188772536_4437%2Fall",
        "https://vk.com/wall-188772536?day=30092023&w=wall-188772536_4404%2Fall",
        "https://vk.com/wall-188772536?day=30092023&w=wall-188772536_4390%2Fall",
        "https://vk.com/wall-188772536?day=30092023&w=wall-188772536_4381%2Fall",
        "https://vk.com/wall-188772536?day=30092023&w=wall-188772536_4371%2Fall",
        "https://vk.com/wall-172291523?day=30092023&w=wall-172291523_29992%2Fall",
        "https://vk.com/wall-172291523?day=30092023&w=wall-172291523_29965%2Fall",
        "https://vk.com/wall-172291523?day=30092023&w=wall-172291523_29961%2Fall",
        "https://vk.com/wall-172291523?day=30092023&w=wall-172291523_29909%2Fall",
        "https://vk.com/wall-172291523?day=30092023&w=wall-172291523_29878%2Fall",
        "https://vk.com/wall-172291523?day=30092023&w=wall-172291523_29803%2Fall",
        "https://vk.com/wall-172291523?day=30092023&w=wall-172291523_29653%2Fall",
        "https://vk.com/wall-172291523?day=30092023&w=wall-172291523_29640%2Fall",
        "https://vk.com/wall-172291523?day=30092023&w=wall-172291523_29512%2Fall",
        "https://vk.com/wall-78860407?day=30092023&w=wall-78860407_67931%2Fall",
        "https://vk.com/wall-78860407?day=30092023&w=wall-78860407_67885%2Fall",
        "https://vk.com/wall-78860407?day=30092023&w=wall-78860407_67881",
        "https://vk.com/wall-78860407?day=30092023&w=wall-78860407_67866%2Fall",
        "https://vk.com/wall-78860407?day=30092023&w=wall-78860407_67818%2Fall",
        "https://vk.com/wall-78860407?day=30092023&w=wall-78860407_67808%2Fall",
        "https://vk.com/wall-78860407?day=30092023&w=wall-78860407_67778",
        "https://vk.com/wall-78860407?day=30092023&w=wall-78860407_67777",
        "https://vk.com/wall-78860407?day=30092023&w=wall-78860407_67751",
        "https://vk.com/wall-78860407?day=30092023&w=wall-78860407_67750",
        "https://vk.com/wall-78860407?day=30092023&w=wall-78860407_67689",
        "https://vk.com/wall-78860407?day=30092023&w=wall-78860407_67681",
        "https://vk.com/wall-78860407?day=30092023&w=wall-78860407_67533",
        "https://vk.com/wall-78860407?day=30092023&w=wall-78860407_67516",
        "https://vk.com/wall-78860407?day=30092023&w=wall-78860407_67489",
        "https://vk.com/wall-78860407?day=30092023&w=wall-78860407_67484",
        "https://vk.com/wall-78860407?day=30092023&w=wall-78860407_67401",
        "https://vk.com/wall-78860407?day=30092023&w=wall-78860407_67382",
        "https://vk.com/wall-78860407?day=30092023&w=wall-78860407_67375",
        "https://vk.com/wall-78860407?day=30092023&w=wall-78860407_67316",
        "https://vk.com/wall-78860407?day=30092023&w=wall-78860407_67311",
        "https://vk.com/wall-78860407?day=30092023&w=wall-78860407_67268",
        "https://vk.com/wall-78860407?day=30092023&w=wall-78860407_67256",
        "https://vk.com/wall-78860407?day=30092023&w=wall-78860407_67240",
        "https://vk.com/wall-78860407?day=30092023&w=wall-78860407_67216",
        "https://vk.com/wall-78860407?day=30092023&w=wall-78860407_67209",
        "https://vk.com/wall-78860407?day=30092023&w=wall-78860407_67164",
        "https://vk.com/wall-78860407?day=30092023&w=wall-78860407_67159",
        "https://vk.com/wall-78860407?day=30092023&w=wall-78860407_67090",
        "https://vk.com/wall-78860407?day=30092023&w=wall-78860407_67086",
        "https://vk.com/wall-78860407?day=30092023&w=wall-78860407_67084",
        "https://vk.com/wall-78860407?day=30092023&w=wall-78860407_67055",
        "https://vk.com/wall-78860407?day=30092023&w=wall-78860407_66999",
        "https://vk.com/wall-78860407?day=30092023&w=wall-78860407_66947",
        "https://vk.com/wall-78860407?day=30092023&w=wall-78860407_66946",
        "https://vk.com/wall-78860407?day=30092023&w=wall-78860407_66943",
        "https://vk.com/wall-78860407?day=30092023&w=wall-78860407_66902",
        "https://vk.com/wall-78860407?day=30092023&w=wall-78860407_66887",
        "https://vk.com/wall-78860407?day=30092023&w=wall-78860407_66875",
        "https://vk.com/wall-78860407?day=30092023&w=wall-78860407_66870",
        "https://vk.com/wall-78860407?day=30092023&w=wall-78860407_66833",
        "https://vk.com/wall-78860407?day=30092023&w=wall-78860407_66812",
        "https://vk.com/wall-78860407?day=30092023&w=wall-78860407_66810",
        "https://vk.com/wall-78860407?day=30092023&w=wall-78860407_66778",
        "https://vk.com/wall-78860407?day=30092023&w=wall-78860407_66729",
        "https://vk.com/wall-78860407?day=30092023&w=wall-78860407_66700",
        "https://vk.com/wall-78860407?day=30092023&w=wall-78860407_66676",
        "https://vk.com/wall-78860407?day=30092023&w=wall-78860407_66647",
        "https://vk.com/wall-78860407?day=30092023&w=wall-78860407_66591",
        "https://vk.com/wall-78860407?day=30092023&w=wall-78860407_66580",
        "https://vk.com/wall-78860407?day=30092023&w=wall-78860407_66533",
        "https://vk.com/wall-78860407?day=30092023&w=wall-78860407_66528",
        "https://vk.com/wall-78860407?day=30092023&w=wall-78860407_66521",
        "https://vk.com/wall-78860407?day=30092023&w=wall-78860407_66508",
        "https://vk.com/wall-78860407?day=30092023&w=wall-78860407_66499",
        "https://vk.com/wall-78860407?day=30092023&w=wall-78860407_66493",
        "https://vk.com/wall-78860407?day=30092023&w=wall-78860407_66469",
        "https://vk.com/wall-78860407?day=30092023&w=wall-78860407_66457",
        "https://vk.com/wall-78860407?day=30092023&w=wall-78860407_66455",
        "https://vk.com/wall-78860407?day=30092023&w=wall-78860407_66416",
        "https://vk.com/wall-78860407?day=30092023&w=wall-78860407_66411",
        "https://vk.com/wall-78860407?day=30092023&w=wall-78860407_66409",
        "https://vk.com/wall-78860407?day=30092023&w=wall-78860407_66386",
        "https://vk.com/wall-78860407?day=30092023&w=wall-78860407_66381",
        "https://vk.com/wall-78860407?day=30092023&w=wall-78860407_66376",
        "https://vk.com/wall-78860407?day=30092023&w=wall-78860407_66354",
        "https://vk.com/wall-78860407?day=30092023&w=wall-78860407_66345",
        "https://vk.com/wall-201790723?day=30092023&w=wall-201790723_4798",
        "https://vk.com/wall-201790723?day=30092023&w=wall-201790723_4795",
        "https://vk.com/wall-201790723?day=30092023&w=wall-201790723_4776",
        "https://vk.com/wall-201790723?day=30092023&w=wall-201790723_4755",
        "https://vk.com/wall-201790723?day=30092023&w=wall-201790723_4737",
        "https://vk.com/wall-201790723?day=30092023&w=wall-201790723_4734",
        "https://vk.com/wall-158004918?day=30092023&w=wall-158004918_9628",
        "https://vk.com/wall-158004918?day=30092023&w=wall-158004918_9598",
        "https://vk.com/wall-158004918?day=30092023&w=wall-158004918_9456",
        "https://vk.com/wall-158004918?day=30092023&w=wall-158004918_9359",
        "https://vk.com/wall-171546839?day=30092023&w=wall-171546839_19082",
        "https://vk.com/wall-171546839?day=30092023&w=wall-171546839_19047",
        "https://vk.com/wall-171546839?day=30092023&w=wall-171546839_19044",
        "https://vk.com/wall-171546839?day=30092023&w=wall-171546839_19043",
        "https://vk.com/wall-171546839?day=30092023&w=wall-171546839_18967",
        "https://vk.com/wall-171546839?day=30092023&w=wall-171546839_18906",
        "https://vk.com/wall-171546839?day=30092023&w=wall-171546839_18897",
        "https://vk.com/wall-171546839?day=30092023&w=wall-171546839_18795",
        "https://vk.com/wall-172676451?day=30092023&w=wall-172676451_11385",
        "https://vk.com/wall-172676451?day=30092023&w=wall-172676451_11382",
        "https://vk.com/wall-185008212?day=30092023&w=wall-185008212_5702",
        "https://vk.com/wall-161095827?day=30092023&w=wall-161095827_13464",
        "https://vk.com/wall-161095827?day=30092023&w=wall-161095827_13455",
        "https://vk.com/wall-161095827?day=30092023&w=wall-161095827_13448",
        "https://vk.com/wall-161095827?day=30092023&w=wall-161095827_13431",
        "https://vk.com/wall-161095827?day=30092023&w=wall-161095827_13400",
        "https://vk.com/wall-161095827?day=30092023&w=wall-161095827_13399",
        "https://vk.com/wall-161095827?day=30092023&w=wall-161095827_13385",
        "https://vk.com/wall-161095827?day=30092023&w=wall-161095827_13379",
        "https://vk.com/wall-161095827?day=30092023&w=wall-161095827_13365",
        "https://vk.com/wall-161095827?day=30092023&w=wall-161095827_13329",
        "https://vk.com/wall-161095827?day=30092023&w=wall-161095827_13315",
        "https://vk.com/wall-161095827?day=30092023&w=wall-161095827_13312",
        "https://vk.com/wall-161095827?day=30092023&w=wall-161095827_13307",
        "https://vk.com/wall-161095827?day=30092023&w=wall-161095827_13278",
        "https://vk.com/wall-161095827?day=30092023&w=wall-161095827_13269"
    ];

    // debug!!!
    //let debug_urls = [];
    //for(let i = 0; i < 3; i += 1){
    //    debug_urls.push(urls[i]);
    //}
    //urls = debug_urls;
    // end debug!

    let current_url = window.location.href;
    console.log("Current url = ", current_url);

    let should_end = false;

    for(let i = 0; i < urls.length; i += 1) {
        if(urls[i] === current_url){
            console.log("Current url matches the requested url at index ", i);
            let parse_result = window.localStorage.getItem(urls[i]);
            if(parse_result === null){
                try {
                    parse_result = await startParse();
                    parse_result = JSON.stringify(parse_result);
                } catch {
                    parse_result = "ERROR";
                }
                console.log("Obtained parse result: ");
                console.log(parse_result);
                window.localStorage.setItem(urls[i], parse_result);
            }
            if(i != urls.length - 1){
                console.log(
                    "Since this url was not the last in the reqeusted list ",
                    " the page url will change to ", urls[i + 1], " at index ", i + 1
                );
                window.location.href = urls[i + 1];
            }
            else {
                should_end = true;
            }

        }
    }
    if(should_end) {
        console.log(
            "The parser script has reached its end. ",
            "Combining results stored in the localStorage into one JSON output"
        );
        let output = {};
        for(let i = 0; i < urls.length; i += 1){
            let item = window.localStorage.getItem(urls[i]);
            console.log("Item at ", i, " equals ", item);
            if(item === "ERROR"){
                item = {
                    "author_name": null,
                    "is_page_admin": null,
                    "page_url": null,
                    "dialogue_index": null
                }
            } else {
                item = JSON.parse(item);
            }
            output[urls[i]] = item;
        }
        // console.log(output);
        output = JSON.stringify(output);
        console.log(output);

        //console.log("I will clear window storage for debug for now");
        //window.localStorage.clear();
    }
}

(function() {
    'use strict';
    console.log("Parser script ready");
    parser_main();

    // Your code here...
})();