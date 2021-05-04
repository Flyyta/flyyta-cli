//Function to map/inject available posts on index page
const postMapFunction = (posts) => {
  return `
            <div class="posts">
                ${posts
                  .map(
                    (post) => `<div class="post">
                    <h3><a href="./${post.path}">${
                      post.attributes.title
                    }</a></h3>
                        <small>${new Date(
                          parseInt(post.attributes.date)
                        ).toDateString()}</small>
                      <p>${post.attributes.description}</p>
                    </div>`
                  )
                  .join("")}
            </div>
          `;
};

module.exports = postMapFunction;
