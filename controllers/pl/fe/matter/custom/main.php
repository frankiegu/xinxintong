<?php
namespace pl\fe\matter\custom;

require_once dirname(dirname(__FILE__)) . '/base.php';
/*
 * 文章控制器
 */
class main extends \pl\fe\matter\base {
	/**
	 *
	 */
	protected function getMatterType() {
		return 'custom';
	}
	/**
	 * 返回单图文视图
	 */
	public function index_action() {
		\TPL::output('/pl/fe/matter/custom/frame');
		exit;
	}
	/**
	 * 返回单图文视图
	 */
	public function edit_action() {
		\TPL::output('/pl/fe/matter/custom/frame');
		exit;
	}
	/**
	 *
	 */
	public function read_action() {
		\TPL::output('/pl/fe/matter/custom/frame');
		exit;
	}
	/**
	 *
	 */
	public function stat_action() {
		\TPL::output('/pl/fe/matter/custom/frame');
		exit;
	}
	/**
	 * 获得可见的图文列表
	 *
	 * $page
	 * $size
	 * post options
	 * --$src p:从父账号检索图文
	 * --$tag
	 * --$channel
	 * --$order
	 *
	 */
	public function list_action($site, $page = 1, $size = 30) {
		if (false === ($oUser = $this->accountUser())) {
			return new \ResponseTimeout();
		}

		if (!($oOptions = $this->getPostJson())) {
			$oOptions = new \stdClass;
		}

		$model = $this->model();
		$site = $model->escape($site);
		/**
		 * select fields
		 */
		$s = "a.id,a.siteid,a.title,a.summary,a.create_at,a.modify_at,a.approved,a.creater,a.creater_name,a.creater_src,'$oUser->id' uid";
		$s .= ",a.read_num,a.score,a.remark_num,a.share_friend_num,a.share_timeline_num,a.download_num";
		/**
		 * where
		 */
		$w = "a.custom_body='Y' and a.siteid='$site' and a.state=1 and finished='Y'";
		/*按名称过滤*/
		if (!empty($oOptions->byTitle)) {
			$w .= " and a.title like '%" . $model->escape($oOptions->byTitle) . "%'";
		}
		if (!empty($oOptions->byTags)) {
			foreach ($oOptions->byTags as $tag) {
				$w .= " and a.matter_mg_tag like '%" . $model->escape($tag->id) . "%'";
			}
		}

		/**
		 * 按频道过滤
		 */
		if (!empty($oOptions->channel)) {
			is_array($oOptions->channel) && $oOptions->channel = implode(',', $oOptions->channel);
			$whichChannel = "exists (select 1 from xxt_channel_matter c where a.id = c.matter_id and c.matter_type='article' and c.channel_id in ($oOptions->channel))";
			$w .= " and $whichChannel";
		}
		if (isset($oOptions->byStar) && $oOptions->byStar === 'Y') {
			$w .= " and exists(select 1 from xxt_account_topmatter t where t.matter_type='custom' and t.matter_id=a.id and userid='{$oUser->id}')";
		}
		/**
		 * 按标签过滤
		 */
		$q = [
			$s,
			'xxt_article a',
			$w,
		];
		/* order */
		!isset($oOptions->order) && $oOptions->order = '';
		switch ($oOptions->order) {
		case 'title':
			$q2['o'] = 'CONVERT(a.title USING gbk ) COLLATE gbk_chinese_ci';
			break;
		case 'read':
			$q2['o'] = 'a.read_num desc';
			break;
		case 'share_friend':
			$q2['o'] = 'a.share_friend_num desc';
			break;
		case 'share_timeline':
			$q2['o'] = 'a.share_timeline_num desc';
			break;
		default:
			$q2['o'] = 'a.modify_at desc';
		}
		/* limit */
		$q2['r'] = ['o' => ($page - 1) * $size, 'l' => $size];

		if ($articles = $model->query_objs_ss($q, $q2)) {
			$q[0] = 'count(*)';
			$total = (int) $model->query_val_ss($q);
			foreach ($articles as &$a) {
				$a->type = 'custom';
			}

			return new \ResponseData(array('customs' => $articles, 'docs' => $articles, 'total' => $total));
		}

		return new \ResponseData(array('customs' => [], 'docs' => [], 'total' => 0));
	}
	/**
	 * 获得指定的图文
	 *
	 * @param int $id article's id
	 */
	public function get_action($site, $id, $cascade = 'Y') {
		if (false === ($user = $this->accountUser())) {
			return new \ResponseTimeout();
		}

		$q = array(
			"a.*,'{$user->id}' uid",
			'xxt_article a',
			"a.siteid='$site' and a.state=1 and a.id=$id",
		);
		if (($article = $this->model()->query_obj_ss($q)) && $cascade === 'Y') {
			$article->type = 'custom';
			/**
			 * channels
			 */
			$article->channels = $this->model('matter\channel')->byMatter($id, 'article');
			/**
			 * tags
			 */
			!empty($article->matter_cont_tag) && $article->matter_cont_tag = json_decode($article->matter_cont_tag);
			!empty($article->matter_mg_tag) && $article->matter_mg_tag = json_decode($article->matter_mg_tag);
			$article->tags = $article->matter_cont_tag;
			$article->tags2 = $article->matter_mg_tag;
			/**
			 * acl
			 */
			$article->acl = $this->model('acl')->byMatter($site, 'article', $id);
			/*所属项目*/
			if ($article->mission_id) {
				$article->mission = $this->model('matter\mission')->byMatter($site, $app->id, 'custom');
			}
		}

		return new \ResponseData($article);
	}
	/**
	 * 创建新图文
	 */
	public function create_action($site, $mission) {
		if (false === ($user = $this->accountUser())) {
			return new \ResponseTimeout();
		}

		$article = array();
		$current = time();
		$customConfig = $this->getPostJson();
		$site = $this->model('site')->byId($site, array('fields' => 'id,heading_pic'));

		/*从站点或项目获取的定义*/
		if (empty($mission)) {
			$article['pic'] = $site->heading_pic; //使用账号缺省头图
			$article['summary'] = '';
		} else {
			$modelMis = $this->model('matter\mission');
			$mission = $modelMis->byId($mission);
			$article['summary'] = $mission->summary;
			$article['pic'] = $mission->pic;
			$article['mission_id'] = $mission->id;
		}

		/*前端指定的信息*/
		$article['title'] = empty($customConfig->proto->title) ? '新定制页' : $customConfig->proto->title;

		$article['siteid'] = $site->id;
		$article['creater'] = $user->id;
		$article['creater_src'] = 'A';
		$article['creater_name'] = $user->name;
		$article['create_at'] = $current;
		$article['modifier'] = $user->id;
		$article['modifier_src'] = 'A';
		$article['modifier_name'] = $user->name;
		$article['modify_at'] = $current;
		$article['author'] = $user->name;
		$article['hide_pic'] = 'N';
		$article['url'] = '';
		$article['body'] = '';
		$article['custom_body'] = 'Y';
		$id = $this->model()->insert('xxt_article', $article, true);

		/* 记录操作日志 */
		$matter = (object) $article;
		$matter->id = $id;
		$matter->type = 'custom';
		$this->model('matter\log')->matterOp($site->id, $user, $matter, 'C');

		/* 记录和任务的关系 */
		if (isset($mission->id)) {
			$modelMis->addMatter($user, $site, $mission->id, $matter);
		}

		return new \ResponseData($id);
	}
	/**
	 * 更新单图文的字段
	 *
	 * $id article's id
	 * $nv pair of name and value
	 */
	public function update_action($site, $id) {
		if (false === ($user = $this->accountUser())) {
			return new \ResponseTimeout();
		}

		$model = $this->model();

		$nv = (array) $this->getPostJson();
		isset($nv['title']) && $nv['title'] = $model->escape($nv['title']);
		isset($nv['summary']) && $nv['summary'] = $model->escape($nv['summary']);
		isset($nv['author']) && $nv['author'] = $model->escape($nv['author']);
		isset($nv['body']) && $nv['body'] = $model->escape(urldecode($nv['body']));

		$rst = $this->_update($site, $id, $nv);

		return new \ResponseData($rst);
	}
	/**
	 * 复制定制页
	 */
	public function copy_action($site, $id) {
		if (false === ($user = $this->accountUser())) {
			return new \ResponseTimeout();
		}

		$modelArt = $this->model('matter\article');
		$modelPage = $this->model('code\page');

		$copied = $modelArt->byId($id);

		$pageid = $modelPage->copy($user->id, $copied->page_id);

		$current = time();
		$article = array();
		$article['siteid'] = $site;
		$article['creater'] = $user->id;
		$article['creater_src'] = 'A';
		$article['creater_name'] = $user->name;
		$article['create_at'] = $current;
		$article['modifier'] = $user->id;
		$article['modifier_src'] = 'A';
		$article['modifier_name'] = $user->name;
		$article['modify_at'] = $current;
		$article['title'] = $copied->title . '-副本';
		$article['author'] = $user->name;
		$article['pic'] = $copied->pic;
		$article['hide_pic'] = 'Y';
		$article['summary'] = $copied->summary;
		$article['url'] = '';
		$article['body'] = '';
		$article['custom_body'] = 'Y';
		$article['page_id'] = $pageid;
		$id = $this->model()->insert('xxt_article', $article, true);

		return new \ResponseData($id);
	}
	/**
	 * 删除定制页
	 * 只是打标记，不真正删除数据
	 */
	public function remove_action($site, $id) {
		if (false === ($user = $this->accountUser())) {
			return new \ResponseTimeout();
		}
		$model = $this->model();
		$matter = $this->model('matter\article')->byId($id, 'id,title,summary,pic');
		$matter->type = 'custom';

		$rst = $model->update(
			'xxt_article',
			['state' => 0, 'modify_at' => time()],
			['siteid' => $site, 'id' => $id]
		);
		/* 将图文从所属的多图文和频道中删除 */
		if ($rst) {
			$model->delete('xxt_channel_matter', ['matter_id' => $id, 'matter_type' => 'custom']);
			$modelNews = $this->model('matter\news');
			if ($news = $modelNews->byMatter($id, 'custom')) {
				foreach ($news as $n) {
					$modelNews->removeMatter($n->id, $id, 'custom');
				}
			}
			/*记录操作日志*/
			$this->model('matter\log')->matterOp($site, $user, $matter, 'Recycle');
		}

		return new \ResponseData($rst);
	}
	/**
	 * 恢复被删除的素材
	 */
	public function restore_action($site, $id) {
		if (false === ($user = $this->accountUser())) {
			return new \ResponseTimeout();
		}

		$model = $this->model('matter\article');
		$custom = $model->byId($id, 'id,title,summary,pic');
		if (false === $custom) {
			return new \ResponseError('数据已经被彻底删除，无法恢复');
		}

		/* 恢复数据 */
		$rst = $model->update('xxt_article', ['state' => 1, 'modify_at' => time()], ['siteid' => $site, 'id' => $id]);

		/* 记录操作日志 */
		$custom->type = 'custom';
		$this->model('matter\log')->matterOp($site, $user, $custom, 'Restore');

		return new \ResponseData($rst);
	}
	/**
	 * 用指定的模板替换定制页面内容
	 *
	 * @param int $id article'id
	 *
	 */
	public function pageByTemplate_action($id, $template) {
		if (false === ($user = $this->accountUser())) {
			return new \ResponseTimeout();
		}

		$modelTemplate = $this->model('matter\template');
		$template = $modelTemplate->byId($template);

		$modelArt = $this->model('matter\article');
		$copied = $modelArt->byId($template->matter_id);
		$target = $modelArt->byId($id);

		$modelPage = $this->model('code\page');
		$pageid = $modelPage->copy($user->id, $copied->page_id, $target->page_id);

		if ($target->page_id === 0) {
			$this->_update($id, ['page_id' => $pageid]);
		}

		$oTargetPage = $modelPage->byId($pageid);

		return new \ResponseData($oTargetPage);
	}
	/**
	 * 更新图文信息并记录操作日志
	 */
	private function _update($siteId, $id, $nv) {
		$user = $this->accountUser();
		$current = time();

		$nv['modifier'] = $user->id;
		$nv['modifier_src'] = $user->src;
		$nv['modifier_name'] = $user->name;
		$nv['modify_at'] = $current;

		$rst = $this->model()->update(
			'xxt_article',
			$nv,
			"siteid='$siteId' and id='$id'"
		);
		/*记录操作日志*/
		$article = $this->model('matter\article')->byId($id, 'id,title,summary,pic');
		$this->model('matter\log')->matterOp($siteId, $user, $article, 'U');

		return $rst;
	}
}