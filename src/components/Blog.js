import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

function Blog() {
  const [posts, setPosts] = useState([]);

  useEffect(() => {
    // Fetch posts from our JSON file
    fetch('/blog/posts/posts.json')
      .then(response => response.json())
      .then(data => setPosts(data.posts))
      .catch(error => console.error('Error loading blog posts:', error));
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-12"
        >
          <div className="text-center">
            <h1 className="text-4xl font-bold mb-4">OnlyEXIF Blog</h1>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Guides and articles about image privacy, metadata, and digital security
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map(post => (
              <motion.a
                key={post.id}
                href={`/blog/posts/${post.slug}`}
                className="block group"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ y: -2 }}
                transition={{ duration: 0.2 }}
              >
                <div className="border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-all h-full flex flex-col">
                  <div className="flex-grow">
                    <h2 className="text-xl font-semibold mb-2 group-hover:text-gray-600">
                      {post.title}
                    </h2>
                    <p className="text-gray-600 text-sm mb-4">
                      {post.excerpt}
                    </p>
                  </div>
                  <div className="flex items-center text-sm text-gray-500 pt-4 border-t border-gray-100">
                    <span>{post.readTime}</span>
                    <span className="mx-2">•</span>
                    <span>{post.category}</span>
                  </div>
                </div>
              </motion.a>
            ))}
          </div>
        </motion.div>
      </main>
    </div>
  );
}

export default Blog; 