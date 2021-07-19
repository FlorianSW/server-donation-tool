function perkBubble(p) {
    const perk = document.createElement('div');
    perk.classList.add('owned-perk', 'card');
    const imgContainer = document.createElement('div');
    imgContainer.classList.add('card-image');

    const image = document.createElement('img');
    if (p.type === 'DISCORD_ROLE') {
        image.src = '/assets/images/discord.svg';
    } else if (p.type === 'PRIORITY_QUEUE') {
        image.src = '/assets/images/rocket-svgrepo-com.svg';
    }
    imgContainer.append(image);

    const content = document.createElement('div');
    content.classList.add('card-content');
    content.textContent = p.text;

    perk.append(imgContainer);
    perk.append(content);

    return perk;
}

function removeLoading() {
    list.querySelectorAll('.loading').forEach((l) => l.remove());
}

function textCard(text) {
    const card = document.createElement('div');
    card.classList.add('card');
    card.textContent = text;
    return card;
}

const list = document.querySelector('.perk-list');

fetch('/donators/@me/perks').then(async (result) => {
    const perks = await result.json();
    if (perks.length === 0) {
        list.append(textCard('You do not own any perks, yet.'));
    } else {
        perks.forEach((p) => list.append(perkBubble(p)));
    }
    removeLoading();
}).catch(() => {
    list.append(textCard('Could not load the perks you own :('));
    removeLoading();
});
